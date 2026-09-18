import { MAX_FILE_BYTES } from "./security";
import {
  safeExternalUrl,
  siteNames,
  scheduleNames,
  type SiteType,
  type Schedule,
} from "./model";

export type GithubSource = { owner: string; repo: string; branch: string };
export const emptySource: GithubSource = {
  owner: "hanchenz910-art",
  repo: "-go",
  branch: "main",
};
export function validSource(source: GithubSource): boolean {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(source.owner) &&
    /^[a-zA-Z0-9_.-]{1,100}$/.test(source.repo) &&
    source.repo !== "." &&
    source.repo !== ".." &&
    /^[a-zA-Z0-9_./-]{1,120}$/.test(source.branch) &&
    !source.branch.includes("..")
  );
}
export function sourceUrl(source: GithubSource): string {
  if (!validSource(source)) throw new Error("请先设置有效的 GitHub 数据仓库");
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch.split("/").map(encodeURIComponent).join("/")}/releases/latest.sxlist.json`;
}
export async function fetchLatest(source: GithubSource): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(sourceUrl(source), {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "未找到已签名名单，请检查仓库和发布路径"
          : `GitHub 返回 ${response.status}`,
      );
    if (Number(response.headers.get("content-length")) > MAX_FILE_BYTES)
      throw new Error("远程文件超过 2 MB 限制");
    if (!response.body) throw new Error("服务器没有返回文件");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let total = 0;
    let text = "";
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_FILE_BYTES) {
        await reader.cancel();
        throw new Error("远程文件超过 2 MB 限制");
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw new Error("暂时无法连接 GitHub，可稍后重试或导入本地名单");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type Contribution = {
  kind: "add" | "feedback" | "correction" | "appeal";
  brand: string;
  company: string;
  siteType: SiteType;
  site: string;
  city: string;
  role: string;
  employment: string;
  schedule: Schedule;
  start: string;
  end: string;
  source: string;
  note: string;
};
export const contributionKinds = {
  add: "补充企业",
  feedback: "作息反馈",
  correction: "资料更正",
  appeal: "企业异议",
};
export const emptyContribution: Contribution = {
  kind: "feedback",
  brand: "",
  company: "",
  siteType: "office",
  site: "",
  city: "",
  role: "",
  employment: "直接用工",
  schedule: "unknown",
  start: "",
  end: "",
  source: "",
  note: "",
};
export function validateContribution(c: Contribution): string | null {
  if ([c.brand, c.company, c.site, c.city, c.role].some((v) => !v.trim()))
    return "请填写品牌、经营主体、具体地点、城市和岗位";
  if (
    !c.start ||
    !c.end ||
    c.start > c.end ||
    c.end > new Date().toISOString().slice(0, 10)
  )
    return "请填写有效的观察时间，结束日期不能晚于今天";
  if (!safeExternalUrl(c.source)) return "请提供可公开访问的 HTTPS 来源链接";
  if (c.note.length > 500) return "补充说明不能超过 500 字";
  const body = [c.brand, c.company, c.site, c.city, c.role, c.note].join(" ");
  if (
    /\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(body)
  )
    return "内容可能包含手机号、身份证号或邮箱，请移除个人信息";
  if (/黑心|血汗|垃圾公司|违法企业|抵制它|曝光个人/.test(body))
    return "请使用可核对的作息事实，移除侮辱或直接法律定性";
  return null;
}
export function issueBody(c: Contribution): string {
  const quote = (v: string) =>
    v
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => "> " + line)
      .join("\n");
  return `### ${contributionKinds[c.kind]}\n\n此投稿为待审核线索，不代表平台认定。\n\n品牌：${quote(c.brand)}\n\n经营主体：${quote(c.company)}\n\n地点类型：${siteNames[c.siteType]}\n\n具体地点：${quote(c.site)}\n\n城市：${quote(c.city)}\n\n岗位：${quote(c.role)}\n\n用工类型：${c.employment}\n\n观察期间：${c.start} 至 ${c.end}\n\n作息情况：${scheduleNames[c.schedule]}\n\n公开来源：${c.source}\n\n补充说明：\n${quote(c.note || "无")}\n\n- [x] 已了解 Issue 公开，内容不包含个人敏感信息或未公开内部资料。\n- [x] 仅陈述上述地点、岗位和期间的信息，不外推整个品牌。\n`;
}
export function issueUrl(source: GithubSource, c: Contribution): string {
  if (!validSource(source)) throw new Error("请先设置 GitHub 数据仓库");
  const error = validateContribution(c);
  if (error) throw new Error(error);
  const url = new URL(
    `https://github.com/${source.owner}/${source.repo}/issues/new`,
  );
  url.searchParams.set(
    "title",
    `[${contributionKinds[c.kind]}] ${c.brand.slice(0, 60)} / ${siteNames[c.siteType]}`,
  );
  url.searchParams.set("body", issueBody(c));
  if (url.toString().length > 7500)
    throw new Error("投稿内容较长，请缩短说明或下载草稿后在 GitHub 粘贴");
  return url.toString();
}
