import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

export function generateKey(id, purpose) {
  if (
    !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
    !["demo", "production"].includes(purpose)
  )
    throw new Error("Invalid key id or purpose");
  const keysPath = resolve("src/trusted-keys.json");
  const keys = JSON.parse(readFileSync(keysPath, "utf8"));
  const privatePath = resolve(".local/keys", id + ".pem");
  if (existsSync(privatePath) || keys.some((k) => k.id === id))
    throw new Error("Key already exists; use a new key id");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const now = new Date();
  const key = {
    id,
    purpose,
    publicKey: Buffer.from(
      publicKey.export({ format: "jwk" }).x,
      "base64url",
    ).toString("base64"),
    notBefore: new Date(now.getTime() - 60000).toISOString(),
    notAfter: new Date(now.getTime() + 3 * 365 * 86400000).toISOString(),
  };
  mkdirSync(resolve(".local/keys"), { recursive: true });
  writeFileSync(
    privatePath,
    privateKey.export({ format: "pem", type: "pkcs8" }),
    { flag: "wx", mode: 0o600 },
  );
  writeFileSync(keysPath, JSON.stringify([...keys, key], null, 2) + "\n");
  return { key, privatePath };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/keygen.mjs")
) {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      purpose: { type: "string", default: "production" },
    },
  });
  if (!values.id)
    throw new Error(
      "Usage: npm run keys:init -- --id maintainer-2026 --purpose production",
    );
  const result = generateKey(values.id, values.purpose);
  console.log(
    `Public key added: ${result.key.id}. Private key saved in .local/keys (gitignored). Rebuild the app to trust this key.`,
  );
}
