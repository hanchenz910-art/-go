import canonicalize from "canonicalize";
import { z } from "zod";
import { datasetSchema, type Dataset } from "./model";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const FORMAT = "rest-evidence/v1";
export type TrustedKey = {
  id: string;
  purpose: "demo" | "production";
  publicKey: string;
  notBefore: string;
  notAfter: string;
};
export type Envelope = {
  format: typeof FORMAT;
  keyId: string;
  body: Dataset;
  signature: string;
};
export type VerifiedBundle = {
  envelope: Envelope;
  data: Dataset;
  digest: string;
  key: TrustedKey;
  expired: boolean;
};
export type HighWater = { sequence: number; digest: string };
const envelopeSchema = z
  .object({
    format: z.literal(FORMAT),
    keyId: z.string().min(1).max(64),
    body: z.record(z.unknown()),
    signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
  })
  .strict();
const encoder = new TextEncoder();

export function signedMessage(value: {
  format: string;
  keyId: string;
  body: unknown;
}): Uint8Array {
  return encoder.encode(
    "rest-evidence:dataset:v1\n" +
      canonicalize({
        format: value.format,
        keyId: value.keyId,
        body: value.body,
      }),
  );
}
export function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyBundle(
  raw: string,
  keys: TrustedKey[],
  now = new Date(),
): Promise<VerifiedBundle> {
  if (encoder.encode(raw).length > MAX_FILE_BYTES)
    throw new Error("文件超过 2 MB 限制");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("无法读取 JSON 文件");
  }
  const outer = envelopeSchema.safeParse(parsed);
  if (!outer.success)
    throw new Error("文件格式不受支持，需要带签名的 .sxlist.json 文件");
  const key = keys.find((k) => k.id === outer.data.keyId);
  if (!key) throw new Error("签名公钥不受信任，未导入此文件");
  const message = signedMessage(outer.data);
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      decodeBase64(key.publicKey),
      "Ed25519",
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        decodeBase64(outer.data.signature),
        message,
      ))
    )
      throw new Error("invalid");
  } catch {
    throw new Error("签名验证失败：文件可能已被修改，原数据保持不变");
  }
  const validated = datasetSchema.safeParse(outer.data.body);
  if (!validated.success)
    throw new Error("数据校验失败：" + validated.error.issues[0].message);
  const data = validated.data;
  if (data.environment !== key.purpose)
    throw new Error("演示密钥不能签发正式数据");
  const issued = Date.parse(data.publishedAt);
  if (issued < Date.parse(key.notBefore) || issued > Date.parse(key.notAfter))
    throw new Error("签发日期不在密钥有效期内");
  if (now.getTime() > Date.parse(key.notAfter))
    throw new Error("签名密钥已过期，请更新应用中的可信公钥");
  if (issued > now.getTime() + 5 * 60000)
    throw new Error("签发日期在未来，请检查设备日期");
  const digest = hex(await crypto.subtle.digest("SHA-256", message));
  return {
    envelope: { ...outer.data, body: data },
    data,
    digest,
    key,
    expired: now.getTime() > Date.parse(data.expiresAt),
  };
}

export function preventRollback(
  bundle: VerifiedBundle,
  highWater?: HighWater,
): void {
  if (!highWater) return;
  if (bundle.data.sequence < highWater.sequence)
    throw new Error("拒绝旧版本：此名单版本低于本机已验证版本");
  if (
    bundle.data.sequence === highWater.sequence &&
    bundle.digest !== highWater.digest
  )
    throw new Error("同一版本出现不同内容，已拒绝替换");
}

export async function readListFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("文件超过 2 MB 限制");
  return file.text();
}
