import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Dataset } from "../src/model";
import {
  assertSigningApproval,
  bodyHash,
  buildCandidate,
  parseContribution,
} from "../scripts/contribution.mjs";

const baseline = JSON.parse(
  readFileSync("tests/fixtures/demo-v2.sxlist.json", "utf8"),
).body as Dataset;
const repo = "hanchenz910-art/-go";
const contributionBody = [
  "### 补充企业",
  "",
  "此投稿为待审核线索，不代表平台认定。",
  "",
  "品牌：共建链路测试品牌（虚构）",
  "",
  "经营主体：共建链路测试主体（虚构）",
  "",
  "地点类型：工厂",
  "",
  "具体地点：共建链路测试厂区（虚构）",
  "",
  "城市：测试城市（虚构）",
  "",
  "岗位：测试岗位（虚构）",
  "",
  "用工类型：直接用工",
  "",
  "观察期间：2026-09-01 至 2026-09-17",
  "",
  "作息情况：周六日双休",
  "",
  "公开来源：https://example.org/fictional-test",
  "",
  "补充说明：",
  "这是虚构测试，不得进入正式名单。",
].join("\n");

function issue(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    html_url: `https://github.com/${repo}/issues/1`,
    user: { login: "hanchenz910-art" },
    body: contributionBody,
    ...overrides,
  };
}

describe("demo contribution pipeline", () => {
  it("parses a structured fictional contribution", () => {
    expect(parseContribution(contributionBody)).toMatchObject({
      brand: "共建链路测试品牌（虚构）",
      siteType: "factory",
      employment: "direct",
      schedule: "weekend",
    });
  });

  it("adds one scoped record and advances the sequence", () => {
    const next = buildCandidate(
      baseline,
      issue(),
      repo,
      new Date("2026-09-18T00:00:00Z"),
    );
    expect(next.sequence).toBe(3);
    expect(next.environment).toBe("demo");
    expect(next.brands).toHaveLength(baseline.brands.length + 1);
    expect(next.sites.at(-1)).toMatchObject({
      id: "issue-1",
      type: "factory",
    });
    expect(next.observations.at(-1)).toMatchObject({
      schedule: "weekend",
      verification: "unverified",
    });
    expect(next.evidence.at(-1)?.excerpt).toContain(bodyHash(contributionBody));
  });

  it("rejects a contribution from anyone except the repository owner", () => {
    expect(() =>
      buildCandidate(
        baseline,
        issue({ user: { login: "someone-else" } }),
        repo,
      ),
    ).toThrow("authored by the owner");
  });

  it("rejects a contribution without an explicit fictional scope", () => {
    expect(() =>
      buildCandidate(
        baseline,
        issue({ body: contributionBody.replaceAll("虚构", "测试") }),
        repo,
      ),
    ).toThrow("fictional scope");
  });

  it("rejects production input", () => {
    expect(() =>
      buildCandidate({ ...baseline, environment: "production" }, issue(), repo),
    ).toThrow();
  });

  it("rejects an issue URL from another repository", () => {
    expect(() =>
      buildCandidate(
        baseline,
        issue({ html_url: "https://github.com/attacker/other/issues/1" }),
        repo,
      ),
    ).toThrow("Unexpected issue origin");
  });

  it("requires the exact reviewed body hash before signing", () => {
    expect(() =>
      assertSigningApproval(
        bodyHash(contributionBody),
        "0".repeat(64),
        "private.pem",
        "demo-local-2026",
      ),
    ).toThrow("Review hash mismatch");
  });
});
