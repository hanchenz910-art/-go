import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  datasetSchema,
  siteNames,
  scheduleNames,
  safeExternalUrl,
} from "../src/model.ts";
import { signDataset } from "./sign.mjs";

export const bodyHash = (body) =>
  createHash("sha256").update(body).digest("hex");
export function assertSigningApproval(hash, approve, key, keyId) {
  if (approve !== hash || !key || !keyId) {
    throw new Error("Review hash mismatch or missing signing key");
  }
}
export function parseContribution(body) {
  if (typeof body !== "string" || body.length > 12000)
    throw new Error("Invalid contribution size");
  const field = (name) => {
    const matches = body
      .split(/\r?\n/)
      .filter((line) => line.startsWith(name + "："));
    if (matches.length !== 1)
      throw new Error("Missing or duplicate field: " + name);
    const value = matches[0]
      .slice(name.length + 1)
      .replace(/^> /, "")
      .trim();
    if (!value || value.length > 200) throw new Error("Invalid field: " + name);
    return value;
  };
  const reverse = (map, name) => {
    const value = Object.entries(map).find(([, v]) => v === field(name))?.[0];
    if (!value) throw new Error("Unknown value: " + name);
    return value;
  };
  const period = field("观察期间").match(
    /^(\d{4}-\d{2}-\d{2}) 至 (\d{4}-\d{2}-\d{2})$/,
  );
  if (!period) throw new Error("Invalid observation period");
  const source = field("公开来源");
  if (!safeExternalUrl(source)) throw new Error("Invalid source");
  return {
    brand: field("品牌"),
    company: field("经营主体"),
    site: field("具体地点"),
    city: field("城市"),
    role: field("岗位"),
    siteType: reverse(siteNames, "地点类型"),
    schedule: reverse(scheduleNames, "作息情况"),
    employment: reverse(
      {
        direct: "直接用工",
        dispatch: "劳务派遣",
        outsourced: "外包用工",
        unknown: "不清楚",
      },
      "用工类型",
    ),
    start: period[1],
    end: period[2],
    source,
  };
}

// Demo-only conversion. Real claims require a separately reviewed dataset.
export function buildCandidate(base, issue, repo, now = new Date()) {
  const data = structuredClone(datasetSchema.parse(base));
  if (data.environment !== "demo")
    throw new Error("This pipeline only generates demo data");
  if (
    !/^[\w-]+\/[\w.-]+$/.test(repo) ||
    !Number.isSafeInteger(issue.number) ||
    issue.number < 1 ||
    issue.pull_request
  )
    throw new Error("Invalid issue");
  if (issue.user?.login !== repo.split("/")[0])
    throw new Error("Demo submission must be authored by the owner");
  const url = `https://github.com/${repo}/issues/${issue.number}`;
  if (issue.html_url !== url) throw new Error("Unexpected issue origin");
  const c = parseContribution(issue.body);
  if (
    ![c.brand, c.company, c.site, c.city, c.role].every((v) =>
      v.includes("虚构"),
    ) ||
    !issue.body.includes("不得进入正式名单")
  )
    throw new Error("Explicit fictional scope is required");
  const prefix = `issue-${issue.number}`;
  if (data.evidence.some((e) => e.id === prefix))
    throw new Error("Issue already included; review changes separately");
  const day = now.toISOString().slice(0, 10);
  data.sequence++;
  data.publishedAt = now.toISOString();
  data.expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
  data.brands.push({
    id: prefix,
    name: c.brand,
    category: "功能测试",
    description: "来自共建的虚构演示记录，不对应真实企业",
  });
  data.entities.push({ id: prefix, name: c.company });
  data.sites.push({
    id: prefix,
    entityId: prefix,
    name: c.site,
    type: c.siteType,
    city: c.city,
    address: "未提供，虚构地点不可导航",
  });
  data.evidence.push({
    id: prefix,
    type: "demo",
    title: "虚构共建测试",
    url,
    publishedAt: day,
    reviewedAt: day,
    excerpt: `测试内容摘要 SHA-256: ${bodyHash(issue.body)}`,
  });
  data.brandSites.push({
    brandId: prefix,
    siteId: prefix,
    relation: "operator",
    productScope: "虚构测试关联",
    evidenceIds: [prefix],
  });
  data.observations.push({
    id: prefix,
    siteId: prefix,
    role: c.role,
    employmentType: c.employment,
    schedule: c.schedule,
    statementType: "experience",
    verification: "unverified",
    periodStart: c.start,
    periodEnd: c.end,
    evidenceIds: [prefix],
    note: "虚构测试，仅验证共建链路，不是作息事实证明",
  });
  return datasetSchema.parse(data);
}

async function main() {
  const { values: v } = parseArgs({
    options: Object.fromEntries(
      [
        "repo",
        "issue",
        "input",
        "out",
        "approve",
        "key",
        "key-id",
        "event",
      ].map((k) => [k, { type: "string" }]),
    ),
  });
  if (!v.repo || !v.input || !v.out)
    throw new Error("Required: --repo --input --out, plus --issue or --event");
  let issue;
  if (v.event) issue = JSON.parse(readFileSync(v.event, "utf8")).issue;
  else {
    if (!/^\d+$/.test(v.issue ?? "") || !/^[\w-]+\/[\w.-]+$/.test(v.repo))
      throw new Error("Invalid source");
    const response = await fetch(
      `https://api.github.com/repos/${v.repo}/issues/${v.issue}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error(`Issue fetch failed: ${response.status}`);
    issue = await response.json();
  }
  const input = JSON.parse(readFileSync(v.input, "utf8"));
  const candidate = buildCandidate(input.body ?? input, issue, v.repo);
  const hash = bodyHash(issue.body);
  let result = {
    issueUrl: issue.html_url,
    bodySha256: hash,
    dataset: candidate,
  };
  if (v.approve || v.key) {
    assertSigningApproval(hash, v.approve, v.key, v["key-id"]);
    result = signDataset(
      candidate,
      readFileSync(v.key, "utf8"),
      v["key-id"],
      JSON.parse(readFileSync("src/trusted-keys.json", "utf8")),
    );
  }
  mkdirSync(dirname(resolve(v.out)), { recursive: true });
  writeFileSync(v.out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      issue: issue.number,
      bodySha256: hash,
      sequence: candidate.sequence,
      signed: !!result.signature,
      out: v.out,
    }),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/contribution.mjs")
)
  await main();
