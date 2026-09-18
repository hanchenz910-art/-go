import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emptyContribution,
  fetchLatest,
  issueUrl,
  issueBody,
  sourceUrl,
  validateContribution,
  validSource,
  type Contribution,
} from "../src/github";
import { MAX_FILE_BYTES } from "../src/security";

const source = { owner: "example", repo: "weekend-data", branch: "main" };
const submission: Contribution = {
  ...emptyContribution,
  brand: "示例品牌",
  company: "示例经营主体",
  siteType: "factory",
  site: "杭州一号厂",
  city: "杭州",
  role: "操作工",
  schedule: "two_days",
  start: "2026-01-01",
  end: "2026-02-01",
  source: "https://example.org/jobs",
  note: "公开招聘口径，实际安排待核实。",
};
afterEach(() => vi.restoreAllMocks());
describe("GitHub submissions", () => {
  it("builds a prefilled issue with site, role and dates, without submitting it", () => {
    const u = new URL(issueUrl(source, submission));
    expect(u.origin).toBe("https://github.com");
    expect(u.pathname).toBe("/example/weekend-data/issues/new");
    expect(u.searchParams.get("body")).toContain("地点类型：工厂");
    expect(u.searchParams.get("body")).toContain("操作工");
    expect(u.searchParams.get("body")).toContain("2026-01-01 至 2026-02-01");
  });
  it.each([
    "13800138000",
    "123456200001011234",
    "person@example.org",
    "黑心公司",
  ])("blocks public submission containing %s", (note) =>
    expect(validateContribution({ ...submission, note })).toBeTruthy(),
  );
  it("requires scope, valid dates, and a public HTTPS source", () => {
    expect(validateContribution({ ...submission, role: "" })).toContain("岗位");
    expect(
      validateContribution({ ...submission, start: "2026-03-01" }),
    ).toContain("时间");
    expect(
      validateContribution({ ...submission, source: "javascript:alert(1)" }),
    ).toContain("HTTPS");
  });
  it("does not silently discard a qualified negative report", () =>
    expect(
      validateContribution({ ...submission, schedule: "single" }),
    ).toBeNull());
  it("exports the same draft content used by the issue link", () =>
    expect(new URL(issueUrl(source, submission)).searchParams.get("body")).toBe(
      issueBody(submission),
    ));
  it("rejects malformed repositories and path traversal", () => {
    expect(validSource({ ...source, owner: "bad/owner" })).toBe(false);
    expect(validSource({ ...source, branch: "../secret" })).toBe(false);
    expect(() => sourceUrl({ ...source, repo: ".." })).toThrow("仓库");
  });
});
describe("network updates", () => {
  it("fetches only the configured raw data path without credentials", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"test":true}'));
    expect(await fetchLatest(source)).toBe('{"test":true}');
    expect(mock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/example/weekend-data/main/releases/latest.sxlist.json",
      expect.objectContaining({ credentials: "omit", redirect: "error" }),
    );
  });
  it("reports unavailable GitHub and missing releases", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("network"));
    await expect(fetchLatest(source)).rejects.toThrow("本地名单");
    mock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchLatest(source)).rejects.toThrow("未找到");
  });
  it("limits streamed payload size even without Content-Length", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(MAX_FILE_BYTES + 1)),
    );
    await expect(fetchLatest(source)).rejects.toThrow("2 MB");
  });
});
