import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const text = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => v.trim().length > 0);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const t = new Date(v);
    return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
  }, "日期无效");
const instant = z.string().datetime({ offset: true });
export const platformNames = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  pdd: "拼多多",
};
export const scheduleNames = {
  weekend: "周六日双休",
  two_days: "每周休两日",
  alternating: "大小周",
  single: "每周休一日",
  shift: "轮班安排",
  unknown: "待补充",
};
export const siteNames = {
  office: "办公室",
  factory: "工厂",
  store: "门店",
  warehouse: "仓储",
  other: "其他",
};
export const statementNames = {
  policy: "公开制度",
  recruitment: "招聘口径",
  experience: "作息反馈",
};
export const verificationNames = {
  public_source: "有公开来源",
  corroborated: "多源核对",
  unverified: "待核实",
  disputed: "存在争议",
};
export type Schedule = keyof typeof scheduleNames;
export type SiteType = keyof typeof siteNames;
export type Platform = keyof typeof platformNames;

export function safeExternalUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !/^(localhost|127\.|\[|0\.)/i.test(u.hostname) &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

export function validShoppingUrl(value: string, platform: Platform): boolean {
  if (!safeExternalUrl(value)) return false;
  const host = new URL(value).hostname;
  const domains = {
    taobao: ["taobao.com"],
    tmall: ["tmall.com"],
    jd: ["jd.com"],
    pdd: ["yangkeduo.com", "pinduoduo.com"],
  }[platform];
  return domains.some(
    (domain) => host === domain || host.endsWith("." + domain),
  );
}

const evidenceSchema = z
  .object({
    id,
    type: z.enum(["policy", "recruitment", "media", "experience", "demo"]),
    title: text,
    url: z.string().max(2000).refine(safeExternalUrl).optional(),
    publishedAt: date,
    reviewedAt: date,
    excerpt: text,
  })
  .strict();
const observationSchema = z
  .object({
    id,
    siteId: id,
    role: text,
    employmentType: z.enum(["direct", "dispatch", "outsourced", "unknown"]),
    schedule: z.enum([
      "weekend",
      "two_days",
      "alternating",
      "single",
      "shift",
      "unknown",
    ]),
    statementType: z.enum(["policy", "recruitment", "experience"]),
    verification: z.enum([
      "public_source",
      "corroborated",
      "unverified",
      "disputed",
    ]),
    periodStart: date,
    periodEnd: date,
    evidenceIds: z.array(id).min(1).max(20),
    note: text,
  })
  .strict()
  .refine((o) => o.periodStart <= o.periodEnd, "观察日期顺序错误");

export const datasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetId: id,
    environment: z.enum(["demo", "production"]),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    publishedAt: instant,
    expiresAt: instant,
    brands: z
      .array(
        z
          .object({ id, name: text, category: text, description: text })
          .strict(),
      )
      .max(5000),
    entities: z.array(z.object({ id, name: text }).strict()).max(10000),
    sites: z
      .array(
        z
          .object({
            id,
            entityId: id,
            name: text,
            type: z.enum(["office", "factory", "store", "warehouse", "other"]),
            city: text,
            address: text,
          })
          .strict(),
      )
      .max(10000),
    brandSites: z
      .array(
        z
          .object({
            brandId: id,
            siteId: id,
            relation: z.enum(["owned", "supplier", "operator"]),
            productScope: text,
            evidenceIds: z.array(id).min(1).max(20),
          })
          .strict(),
      )
      .max(20000),
    observations: z.array(observationSchema).max(20000),
    evidence: z.array(evidenceSchema).max(20000),
    shoppingLinks: z
      .array(
        z
          .object({
            id,
            brandId: id,
            platform: z.enum(["taobao", "tmall", "jd", "pdd"]),
            kind: z.enum(["search", "store", "product"]),
            label: text,
            url: z.string().max(2000),
            verifiedAt: date,
          })
          .strict()
          .refine(
            (v) => validShoppingUrl(v.url, v.platform),
            "购物链接不属于所选平台",
          ),
      )
      .max(10000),
    stores: z
      .array(
        z
          .object({
            id,
            brandId: id,
            name: text,
            city: text,
            address: text,
            verifiedAt: date,
          })
          .strict(),
      )
      .max(10000),
  })
  .strict()
  .superRefine((data, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (Date.parse(data.expiresAt) <= Date.parse(data.publishedAt))
      fail("有效期必须晚于发布日");
    const groups = [
      data.brands,
      data.entities,
      data.sites,
      data.observations,
      data.evidence,
      data.shoppingLinks,
      data.stores,
    ];
    for (const group of groups)
      if (new Set(group.map((v) => v.id)).size !== group.length)
        fail("存在重复记录 ID");
    const has = (group: { id: string }[], value: string) =>
      group.some((v) => v.id === value);
    for (const s of data.sites)
      if (!has(data.entities, s.entityId)) fail("地点所属主体不存在");
    for (const r of data.brandSites) {
      if (!has(data.brands, r.brandId) || !has(data.sites, r.siteId))
        fail("品牌地点关联不存在");
      for (const eid of r.evidenceIds)
        if (!has(data.evidence, eid)) fail("关联证据不存在");
    }
    if (
      new Set(data.brandSites.map((r) => r.brandId + ":" + r.siteId)).size !==
      data.brandSites.length
    )
      fail("品牌地点关联重复");
    for (const o of data.observations) {
      if (!has(data.sites, o.siteId)) fail("作息地点不存在");
      for (const eid of o.evidenceIds)
        if (!has(data.evidence, eid)) fail("作息证据不存在");
      if (o.periodEnd > data.publishedAt.slice(0, 10))
        fail("实际观察期不能晚于签发日期");
    }
    for (const entry of [...data.shoppingLinks, ...data.stores])
      if (!has(data.brands, entry.brandId)) fail("渠道所属品牌不存在");
    if (
      data.environment === "production" &&
      data.evidence.some((e) => e.type === "demo" || !e.url)
    )
      fail("正式数据必须提供公开来源，不能使用演示证据");
  });

export type Dataset = z.infer<typeof datasetSchema>;
export type Brand = Dataset["brands"][number];
export type Site = Dataset["sites"][number];
export type Observation = Dataset["observations"][number];

export function relatedSites(
  data: Dataset,
  brandId: string,
  type?: SiteType,
): Site[] {
  const ids = new Set(
    data.brandSites.filter((r) => r.brandId === brandId).map((r) => r.siteId),
  );
  return data.sites.filter((s) => ids.has(s.id) && (!type || s.type === type));
}

export function scopeSummary(
  data: Dataset,
  sites: Site[],
  now = new Date(),
): { label: string; tone: string } {
  if (!sites.length) return { label: "暂无资料", tone: "muted" };
  const observations = data.observations.filter((o) =>
    sites.some((s) => s.id === o.siteId),
  );
  if (!observations.length) return { label: "待补充", tone: "muted" };
  if (observations.some((o) => o.verification === "disputed"))
    return { label: "存在争议", tone: "red" };
  if (
    observations.every(
      (o) => now.getTime() - Date.parse(o.periodEnd) > 180 * 86400000,
    )
  )
    return { label: "资料待复核", tone: "amber" };
  const schedules = new Set(observations.map((o) => o.schedule));
  if (schedules.size > 1) return { label: "地点 / 岗位有差异", tone: "amber" };
  if (sites.some((s) => !observations.some((o) => o.siteId === s.id)))
    return { label: "部分地点待补充", tone: "muted" };
  const schedule = observations[0].schedule;
  if (observations.some((o) => o.verification === "unverified"))
    return { label: "反馈待核实", tone: "muted" };
  if (observations.every((o) => o.statementType === "recruitment"))
    return {
      label: `招聘注明${schedule === "weekend" ? "双休" : scheduleNames[schedule]}`,
      tone: "blue",
    };
  return {
    label: scheduleNames[schedule],
    tone: schedule === "weekend" || schedule === "two_days" ? "teal" : "muted",
  };
}
