import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  signedMessage,
  verifyBundle,
  preventRollback,
  FORMAT,
  MAX_FILE_BYTES,
  type TrustedKey,
} from "../src/security";
import {
  datasetSchema,
  scopeSummary,
  relatedSites,
  validShoppingUrl,
  safeExternalUrl,
  type Dataset,
} from "../src/model";
import { acceptBundle, clearDataset, readState } from "../src/storage";
import { signDataset } from "../scripts/sign.mjs";

const baseline = JSON.parse(readFileSync("data/demo.json", "utf8")) as Dataset;
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const key: TrustedKey = {
  id: "test-key",
  purpose: "demo",
  publicKey: Buffer.from(
    publicKey.export({ format: "jwk" }).x!,
    "base64url",
  ).toString("base64"),
  notBefore: "2020-01-01T00:00:00Z",
  notAfter: "2099-01-01T00:00:00Z",
};
const now = new Date(baseline.publishedAt);
function signed(body: unknown = baseline, keyId = key.id) {
  const value = { format: FORMAT, keyId, body };
  return JSON.stringify({
    ...value,
    signature: sign(null, signedMessage(value), privateKey).toString("base64"),
  });
}
function copy() {
  return structuredClone(baseline);
}

describe("signed data boundary", () => {
  it("verifies a valid Ed25519 package and a stable content digest", async () => {
    const result = await verifyBundle(signed(), [key], now);
    expect(result.data.brands.length).toBe(8);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expired).toBe(false);
  });
  it.each(["body", "date", "signature"])(
    "rejects a changed %s",
    async (part) => {
      const raw = JSON.parse(signed());
      if (part === "body") raw.body.brands[0].name = "tampered";
      if (part === "date") raw.body.publishedAt = "2020-01-01T00:00:00Z";
      if (part === "signature") raw.signature = "A".repeat(86) + "==";
      await expect(
        verifyBundle(JSON.stringify(raw), [key], now),
      ).rejects.toThrow("签名验证失败");
    },
  );
  it("rejects unknown keys and key replacement supplied in data", async () => {
    await expect(verifyBundle(signed(), [], now)).rejects.toThrow("不受信任");
    const raw = JSON.parse(signed());
    raw.publicKey = key.publicKey;
    await expect(verifyBundle(JSON.stringify(raw), [key], now)).rejects.toThrow(
      "格式",
    );
  });
  it("does not allow demonstration keys to sign production lists", async () => {
    const data = copy();
    data.environment = "production";
    data.evidence = data.evidence.map((e) => ({
      ...e,
      type: "policy",
      url: "https://example.org/policy",
    }));
    await expect(verifyBundle(signed(data), [key], now)).rejects.toThrow(
      "演示密钥",
    );
  });
  it("marks expired data without presenting it as current", async () => {
    const future = new Date(Date.parse(baseline.expiresAt) + 1);
    expect((await verifyBundle(signed(), [key], future)).expired).toBe(true);
  });
  it("rejects future dates, expired keys and invalid key periods", async () => {
    await expect(
      verifyBundle(signed(), [key], new Date(now.getTime() - 86400000)),
    ).rejects.toThrow("未来");
    await expect(
      verifyBundle(
        signed(),
        [{ ...key, notAfter: "2020-01-02T00:00:00Z" }],
        now,
      ),
    ).rejects.toThrow("有效期");
    await expect(
      verifyBundle(signed(), [key], new Date("2100-01-01")),
    ).rejects.toThrow("密钥已过期");
  });
  it("allows formatting changes but preserves all signed values on export", async () => {
    const data = copy();
    data.brands[0].description = "  significant spaces  ";
    const result = await verifyBundle(signed(data), [key], now);
    expect(
      (await verifyBundle(JSON.stringify(result.envelope, null, 2), [key], now))
        .digest,
    ).toBe(result.digest);
    expect(result.data.brands[0].description).toBe("  significant spaces  ");
  });
  it("rejects oversized files before parsing", async () => {
    await expect(
      verifyBundle("x".repeat(MAX_FILE_BYTES + 1), [key], now),
    ).rejects.toThrow("2 MB");
  });
  it("rejects rollback and same-version conflicting content", async () => {
    const result = await verifyBundle(signed(), [key], now);
    expect(() =>
      preventRollback(result, { sequence: 2, digest: result.digest }),
    ).toThrow("旧版本");
    expect(() =>
      preventRollback(result, { sequence: 1, digest: "a".repeat(64) }),
    ).toThrow("不同内容");
    expect(() =>
      preventRollback(result, { sequence: 1, digest: result.digest }),
    ).not.toThrow();
  });
  it("round trips the actual maintainer signing tool through the client verifier", async () => {
    const envelope = signDataset(
      baseline,
      privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      key.id,
      [key],
    );
    expect(
      (await verifyBundle(JSON.stringify(envelope), [key], now)).data,
    ).toEqual(baseline);
  });
});

describe("schema, scope and external links", () => {
  it("never propagates office schedules into a factory with no evidence", () => {
    const sites = relatedSites(baseline, "brand-07", "factory");
    expect(scopeSummary(baseline, sites, now).label).toBe("待补充");
    expect(
      scopeSummary(baseline, relatedSites(baseline, "brand-07", "office"), now)
        .label,
    ).toBe("周六日双休");
  });
  it("keeps multiple and shared factories distinct", () => {
    expect(relatedSites(baseline, "brand-01", "factory")).toHaveLength(2);
    expect(
      relatedSites(baseline, "brand-03", "factory").some(
        (s) => s.id === "shared-factory",
      ),
    ).toBe(true);
    expect(
      scopeSummary(baseline, relatedSites(baseline, "brand-01", "factory"), now)
        .label,
    ).toBe("地点 / 岗位有差异");
  });
  it("labels recruitment and disputes without declaring legal compliance", () => {
    expect(
      scopeSummary(baseline, relatedSites(baseline, "brand-04", "factory"), now)
        .label,
    ).toBe("招聘注明双休");
    expect(
      scopeSummary(baseline, relatedSites(baseline, "brand-05", "factory"), now)
        .label,
    ).toBe("存在争议");
    expect(
      scopeSummary(baseline, relatedSites(baseline, "brand-08", "factory"), now)
        .label,
    ).toBe("资料待复核");
  });
  it.each(["duplicate", "orphan", "future", "period", "schema"])(
    "rejects %s data relationships",
    (mode) => {
      const d = copy();
      if (mode === "duplicate") d.brands.push(d.brands[0]);
      if (mode === "orphan") d.observations[0].siteId = "missing";
      if (mode === "future") d.observations[0].periodEnd = "2099-01-01";
      if (mode === "period") d.expiresAt = d.publishedAt;
      if (mode === "schema") (d as { schemaVersion: number }).schemaVersion = 2;
      expect(datasetSchema.safeParse(d).success).toBe(false);
    },
  );
  it.each([
    "https://jd.com.attacker.example/x",
    "javascript:alert(1)",
    "http://item.jd.com/1.html",
    "https://jd.com@attacker.example/",
    "https://item.jd.com:8443/1.html",
  ])("rejects unsafe shopping URL %s", (url) =>
    expect(validShoppingUrl(url, "jd")).toBe(false),
  );
  it("allows the right platform only", () => {
    expect(validShoppingUrl("https://item.jd.com/1.html", "jd")).toBe(true);
    expect(validShoppingUrl("https://item.jd.com/1.html", "taobao")).toBe(
      false,
    );
    expect(safeExternalUrl("https://127.0.0.1/")).toBe(false);
  });
});

describe("transactional local persistence", () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  it("preserves anti-rollback metadata after clearing and reloading", async () => {
    const state = acceptBundle(
      { highWaters: {}, history: [] },
      await verifyBundle(signed(), [key], now),
      "test",
    );
    clearDataset(state);
    const restored = readState();
    expect(restored.raw).toBeUndefined();
    expect(restored.initialized).toBe(true);
    expect(restored.highWaters["demo:demo-directory"].sequence).toBe(1);
  });
  it("leaves the prior bundle untouched when replacement is rejected", async () => {
    const d = copy();
    d.sequence = 2;
    const current = acceptBundle(
      { highWaters: {}, history: [] },
      await verifyBundle(signed(d), [key], now),
      "test",
    );
    const stored = [...values.values()][0];
    const older = await verifyBundle(signed(), [key], now);
    expect(() => acceptBundle(current, older, "test")).toThrow("旧版本");
    expect([...values.values()][0]).toBe(stored);
  });
  it("detects structurally corrupted caches", () => {
    values.set(
      "rest-evidence:v1",
      JSON.stringify({ highWaters: {}, history: [null] }),
    );
    expect(() => readState()).toThrow("缓存格式损坏");
  });
});
