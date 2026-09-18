import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { generateKey } from "./keygen.mjs";
import { signDataset } from "./sign.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarCheck2 } from "lucide-react";

const keyId = "demo-local-2026";
const keyPath = ".local/keys/" + keyId + ".pem";
if (!existsSync(keyPath)) generateKey(keyId, "demo");
const now = new Date();
const today = now.toISOString().slice(0, 10);
const monthAgo = new Date(now.getTime() - 30 * 86400000)
  .toISOString()
  .slice(0, 10);
const yearAgo = new Date(now.getTime() - 365 * 86400000)
  .toISOString()
  .slice(0, 10);
const dataset = {
  schemaVersion: 1,
  datasetId: "demo-directory",
  environment: "demo",
  sequence: 1,
  publishedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(),
  brands: [],
  entities: [],
  sites: [],
  brandSites: [],
  observations: [],
  evidence: [],
  shoppingLinks: [],
  stores: [],
};
const rows = [
  [
    "日用家居",
    "杯壶与日用收纳",
    "杭州",
    "宁波",
    "weekend",
    "weekend",
    "policy",
  ],
  [
    "个人护理",
    "洗护与清洁用品",
    "上海",
    "苏州",
    "weekend",
    "two_days",
    "recruitment",
  ],
  ["数码配件", "键盘与桌面配件", "深圳", "东莞", "weekend", "shift", "policy"],
  [
    "日用家居",
    "居家清洁与厨房用品",
    "成都",
    "绵阳",
    "weekend",
    "weekend",
    "recruitment",
  ],
  [
    "个人护理",
    "个人护理与生活纸品",
    "广州",
    "佛山",
    "two_days",
    "single",
    "experience",
  ],
  [
    "数码配件",
    "充电配件与线材",
    "南京",
    "无锡",
    "unknown",
    "weekend",
    "policy",
  ],
  [
    "日用家居",
    "家用纺织与织物",
    "合肥",
    "芜湖",
    "weekend",
    "unknown",
    "policy",
  ],
  [
    "个人护理",
    "衣物护理与清洁用品",
    "厦门",
    "泉州",
    "weekend",
    "weekend",
    "policy",
  ],
];
for (const [index, row] of rows.entries()) {
  const n = String(index + 1).padStart(2, "0");
  const bid = "brand-" + n;
  const eid = "entity-" + n;
  const [
    category,
    description,
    officeCity,
    factoryCity,
    officeSchedule,
    factorySchedule,
    statementType,
  ] = row;
  dataset.brands.push({
    id: bid,
    name: `演示品牌 ${n}`,
    category,
    description,
  });
  dataset.entities.push({ id: eid, name: `演示经营主体 ${n}（虚构）` });
  const evidenceId = "evidence-" + n;
  dataset.evidence.push({
    id: evidenceId,
    type: "demo",
    title: `演示作息资料 ${n}（非真实证据）`,
    publishedAt: index === 7 ? yearAgo : monthAgo,
    reviewedAt: today,
    excerpt:
      "仅用于验证地点、岗位、期间和证据展示。全部名称、制度和经营关系均为虚构。",
  });
  for (const type of ["office", "factory"]) {
    const sid = `${bid}-${type}`;
    const city = type === "office" ? officeCity : factoryCity;
    dataset.sites.push({
      id: sid,
      entityId: eid,
      name: `${city}${type === "office" ? "办公室" : "一号工厂"}（演示）`,
      type,
      city,
      address: `${city}市 · 演示地址，不对应真实地点`,
    });
    dataset.brandSites.push({
      brandId: bid,
      siteId: sid,
      relation: type === "office" ? "operator" : "owned",
      productScope: description,
      evidenceIds: [evidenceId],
    });
    if (index === 6 && type === "factory") continue;
    dataset.observations.push({
      id: sid + "-obs",
      siteId: sid,
      role: type === "office" ? "行政与财务" : "生产操作岗",
      employmentType: "direct",
      schedule: type === "office" ? officeSchedule : factorySchedule,
      statementType,
      verification:
        index === 4 && type === "factory"
          ? "disputed"
          : index === 5 && type === "office"
            ? "unverified"
            : "public_source",
      periodStart: index === 7 ? yearAgo : monthAgo,
      periodEnd: index === 7 ? yearAgo : today,
      evidenceIds: [evidenceId],
      note: "演示记录，仅覆盖列明岗位；其他岗位、劳务派遣与外包人员安排未知。",
    });
  }
  dataset.shoppingLinks.push({
    id: bid + "-jd",
    brandId: bid,
    platform: "jd",
    kind: "search",
    label: "京东品类搜索（演示）",
    url: `https://search.jd.com/Search?keyword=${encodeURIComponent(description.split("与")[0])}`,
    verifiedAt: today,
  });
  if (index < 3)
    dataset.stores.push({
      id: bid + "-store",
      brandId: bid,
      name: `演示门店 ${n}`,
      city: officeCity,
      address: `${officeCity}市 · 示例商业街（虚构，不提供导航）`,
      verifiedAt: today,
    });
}
dataset.sites.push({
  id: "shared-factory",
  entityId: "entity-03",
  name: "协作二号工厂（演示）",
  type: "factory",
  city: "嘉兴",
  address: "嘉兴市 · 演示地址，不对应真实地点",
});
dataset.brandSites.push(
  ...["brand-01", "brand-03"].map((brandId) => ({
    brandId,
    siteId: "shared-factory",
    relation: "supplier",
    productScope: "部分产品委托生产，具体批次待核实",
    evidenceIds: ["evidence-03"],
  })),
);
dataset.observations.push({
  id: "shared-obs",
  siteId: "shared-factory",
  role: "包装岗",
  employmentType: "dispatch",
  schedule: "alternating",
  statementType: "recruitment",
  verification: "public_source",
  periodStart: monthAgo,
  periodEnd: today,
  evidenceIds: ["evidence-03"],
  note: "演示：同一工厂服务多个品牌，岗位安排不继承品牌总部制度。",
});
mkdirSync("data", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("data/demo.json", JSON.stringify(dataset, null, 2) + "\n");
const envelope = signDataset(
  dataset,
  readFileSync(keyPath, "utf8"),
  keyId,
  JSON.parse(readFileSync("src/trusted-keys.json", "utf8")),
);
writeFileSync(
  "public/demo.sxlist.json",
  JSON.stringify(envelope, null, 2) + "\n",
);
mkdirSync("tests/fixtures", { recursive: true });
const updated = structuredClone(dataset);
updated.sequence = 2;
updated.brands[0].description = "杯壶与日用收纳（更新后的演示资料）";
writeFileSync(
  "tests/fixtures/demo-v2.sxlist.json",
  JSON.stringify(
    signDataset(
      updated,
      readFileSync(keyPath, "utf8"),
      keyId,
      JSON.parse(readFileSync("src/trusted-keys.json", "utf8")),
    ),
    null,
    2,
  ) + "\n",
);
const icon = renderToStaticMarkup(
  createElement(CalendarCheck2, {
    width: 512,
    height: 512,
    color: "#087f73",
    strokeWidth: 1.6,
  }),
);
writeFileSync("public/icon.svg", icon);
console.log(
  "Created signed fictional demo data. Private key remains under .local/keys.",
);
