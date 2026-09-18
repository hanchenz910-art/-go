import { useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Factory,
  MapPin,
  ShoppingBag,
  FileText,
  CalendarDays,
  ChevronDown,
  MessageSquarePlus,
} from "lucide-react";
import {
  relatedSites,
  siteNames,
  scheduleNames,
  statementNames,
  verificationNames,
  platformNames,
  type Brand,
  type Dataset,
  type Site,
} from "./model";
import { Drawer, Badge, ExternalLinkButton, CopyButton } from "./components";
import { BrandImage } from "./Directory";

export default function BrandDetail({
  brand,
  data,
  onClose,
  onFeedback,
}: {
  brand: Brand;
  data: Dataset;
  onClose: () => void;
  onFeedback: (brand: Brand, site?: Site) => void;
}) {
  const [tab, setTab] = useState<"records" | "shopping" | "stores">("records");
  const [scope, setScope] = useState("all");
  const sites = relatedSites(data, brand.id);
  const channels = data.shoppingLinks.filter((s) => s.brandId === brand.id);
  const stores = data.stores.filter((s) => s.brandId === brand.id);
  return (
    <Drawer title={brand.name} onClose={onClose}>
      <div className="brand-detail-title">
        <BrandImage category={brand.category} />
        <div>
          <span className="eyebrow">{brand.category}</span>
          <h2>{brand.name}</h2>
          <p>{brand.description}</p>
        </div>
      </div>
      {data.environment === "demo" && (
        <div className="notice amber compact">
          演示档案：企业、地点、作息和证据均为虚构。
        </div>
      )}
      <div className="detail-tabs" role="tablist" aria-label="档案内容">
        {(
          [
            ["records", "作息记录", FileText],
            ["shopping", "购买渠道", ShoppingBag],
            ["stores", "实体门店", MapPin],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            <Icon size={16} />
            {label}
            {value === "records" ? ` ${sites.length}` : ""}
          </button>
        ))}
      </div>
      {tab === "records" && (
        <div className="detail-content">
          <div className="detail-toolbar">
            <span>{sites.length} 个关联地点</span>
            <select
              aria-label="档案地点类型"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">全部地点</option>
              <option value="office">办公室</option>
              <option value="factory">工厂</option>
            </select>
          </div>
          {sites
            .filter((s) => scope === "all" || s.type === scope)
            .map((site) => {
              const relation = data.brandSites.find(
                (r) => r.brandId === brand.id && r.siteId === site.id,
              )!;
              const observations = data.observations.filter(
                (o) => o.siteId === site.id,
              );
              return (
                <section className="site-section" key={site.id}>
                  <div className="site-title">
                    <span
                      className={`stat-icon ${site.type === "factory" ? "blue" : "teal"}`}
                    >
                      {site.type === "factory" ? (
                        <Factory size={20} />
                      ) : (
                        <Building2 size={20} />
                      )}
                    </span>
                    <div>
                      <h3>{site.name}</h3>
                      <p>
                        {siteNames[site.type]} · {site.city} ·{" "}
                        {relation.relation === "supplier"
                          ? "合作供应商"
                          : relation.relation === "owned"
                            ? "自有生产"
                            : "品牌运营"}
                      </p>
                    </div>
                  </div>
                  <div className="entity-line">
                    {data.entities.find((e) => e.id === site.entityId)?.name}
                  </div>
                  <p className="scope-note">
                    关联范围：{relation.productScope}
                  </p>
                  {observations.length ? (
                    observations.map((o) => (
                      <div className="observation" key={o.id}>
                        <div className="observation-heading">
                          <strong>{scheduleNames[o.schedule]}</strong>
                          <Badge
                            tone={
                              o.verification === "disputed"
                                ? "red"
                                : o.verification === "unverified"
                                  ? "muted"
                                  : "teal"
                            }
                          >
                            {verificationNames[o.verification]}
                          </Badge>
                        </div>
                        <dl className="fact-grid">
                          <div>
                            <dt>适用岗位</dt>
                            <dd>{o.role}</dd>
                          </div>
                          <div>
                            <dt>用工类型</dt>
                            <dd>
                              {
                                {
                                  direct: "直接用工",
                                  dispatch: "劳务派遣",
                                  outsourced: "外包用工",
                                  unknown: "未明确",
                                }[o.employmentType]
                              }
                            </dd>
                          </div>
                          <div>
                            <dt>资料性质</dt>
                            <dd>{statementNames[o.statementType]}</dd>
                          </div>
                          <div>
                            <dt>观察期间</dt>
                            <dd>
                              {o.periodStart} 至 {o.periodEnd}
                            </dd>
                          </div>
                        </dl>
                        <p className="observation-note">{o.note}</p>
                        {Date.now() - Date.parse(o.periodEnd) >
                          180 * 86400000 && (
                          <div className="notice amber compact">
                            <CalendarDays size={16} />
                            观察资料超过 180 天，当前安排待复核。
                          </div>
                        )}
                        <details className="evidence">
                          <summary>
                            <FileText size={14} />
                            查看来源与证据 <span>{o.evidenceIds.length}</span>
                            <ChevronDown size={14} />
                          </summary>
                          {o.evidenceIds.map((id) => {
                            const e = data.evidence.find((e) => e.id === id)!;
                            return (
                              <div className="evidence-entry" key={id}>
                                <strong>{e.title}</strong>
                                <p>{e.excerpt}</p>
                                <small>
                                  发布 {e.publishedAt} · 复核 {e.reviewedAt}
                                </small>
                                {e.url && (
                                  <ExternalLinkButton href={e.url}>
                                    查看公开原文
                                  </ExternalLinkButton>
                                )}
                              </div>
                            );
                          })}
                        </details>
                      </div>
                    ))
                  ) : (
                    <div className="missing-record">
                      尚无该地点的作息资料，不能继承总部安排。
                    </div>
                  )}
                  <button
                    className="text-button site-feedback"
                    onClick={() => onFeedback(brand, site)}
                  >
                    <MessageSquarePlus size={15} />
                    补充或更正此地点 <ArrowUpRight size={14} />
                  </button>
                </section>
              );
            })}
        </div>
      )}
      {tab === "shopping" && (
        <div className="detail-content">
          <p className="section-note">
            渠道信息不代表商品品质背书，也不证明该商品由某一工厂生产。
          </p>
          {channels.map((c) => (
            <div className="channel-row" key={c.id}>
              <span className={`platform-icon ${c.platform}`}>
                {platformNames[c.platform].slice(0, 1)}
              </span>
              <div>
                <strong>{c.label}</strong>
                <p>
                  {c.kind === "search"
                    ? "平台搜索，非已核实店铺"
                    : c.kind === "store"
                      ? "店铺链接"
                      : "商品链接"}{" "}
                  · 复核 {c.verifiedAt}
                </p>
              </div>
              <ExternalLinkButton href={c.url}>
                前往{platformNames[c.platform]}
              </ExternalLinkButton>
            </div>
          ))}
          {!channels.length && (
            <div className="missing-record">暂未核实该品牌的购物渠道。</div>
          )}
        </div>
      )}
      {tab === "stores" && (
        <div className="detail-content">
          <p className="section-note">
            销售门店的作息与品牌办公室、生产工厂分别核验。
          </p>
          {stores.map((s) => (
            <section className="store-row" key={s.id}>
              <MapPin size={22} />
              <div>
                <h3>{s.name}</h3>
                <p>{s.address}</p>
                <small>地址复核 {s.verifiedAt}</small>
                <div className="store-actions">
                  <CopyButton value={s.address} label="复制地址" />
                  {data.environment === "production" && (
                    <ExternalLinkButton
                      href={`https://uri.amap.com/search?keyword=${encodeURIComponent(s.name + " " + s.address)}&city=${encodeURIComponent(s.city)}`}
                    >
                      地图位置
                    </ExternalLinkButton>
                  )}
                </div>
              </div>
            </section>
          ))}
          {!stores.length && (
            <div className="missing-record">暂无核实后的实体门店地址。</div>
          )}
        </div>
      )}
      <footer className="drawer-footer">
        名单签名仅验证来源与内容完整性，不等于事实认证。
      </footer>
    </Drawer>
  );
}
