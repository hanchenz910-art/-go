import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import canonicalize from "canonicalize";
import { datasetSchema } from "../src/model.ts";

export function signDataset(body, keyPem, keyId, keys) {
  const data = datasetSchema.parse(body);
  const trusted = keys.find((k) => k.id === keyId);
  if (!trusted || trusted.purpose !== data.environment)
    throw new Error("Key purpose does not match dataset");
  const privateKey = createPrivateKey(keyPem);
  const rawPublic = Buffer.from(
    createPublicKey(privateKey).export({ format: "jwk" }).x,
    "base64url",
  ).toString("base64");
  if (rawPublic !== trusted.publicKey)
    throw new Error("Private key does not match trusted public key");
  const issued = Date.parse(data.publishedAt);
  if (
    issued < Date.parse(trusted.notBefore) ||
    issued > Date.parse(trusted.notAfter) ||
    issued > Date.now() + 300000
  )
    throw new Error("Invalid signing date");
  const unsigned = { format: "rest-evidence/v1", keyId, body: data };
  const message = Buffer.from(
    "rest-evidence:dataset:v1\n" + canonicalize(unsigned),
    "utf8",
  );
  return {
    ...unsigned,
    signature: sign(null, message, privateKey).toString("base64"),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/sign.mjs")
) {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      key: { type: "string" },
      "key-id": { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.input || !values.key || !values["key-id"] || !values.out)
    throw new Error("Required: --input --key --key-id --out");
  const result = signDataset(
    JSON.parse(readFileSync(values.input, "utf8")),
    readFileSync(values.key, "utf8"),
    values["key-id"],
    JSON.parse(readFileSync("src/trusted-keys.json", "utf8")),
  );
  mkdirSync(dirname(resolve(values.out)), { recursive: true });
  writeFileSync(values.out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `Signed ${result.body.datasetId} v${result.body.sequence} -> ${values.out}`,
  );
}
