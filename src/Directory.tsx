import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Bookmark,
  Building2,
  Factory,
  SearchX,
  X,
  ArrowDownWideNarrow,
} from "lucide-react";
import {
  relatedSites,
  scopeSummary,
  scheduleNames,
  type Brand,
  type Dataset,
  type SiteType,
  type Schedule,
} from "./model";
import { Badge, IconButton } from "./components";

export function BrandImage({ category }: { category: string }) {
  const path =
    category === "个人护理"
      ? "care"
      : category === "数码配件"
        ? "tech"
        : "home";
  return (
    <div className={`brand-image ${path}`}>
      <img
        src={`${import.meta.env.BASE_URL}images/${path}.jpg`}
        alt={`${category}品类示意`}
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}

export default function Directory({
  data,
  onSelect,
  saved,
  onSave,
  onlySaved,
  onImport,
  onDemo,
  onContribute,
}: {
  data?: Dataset;
  onSelect: (b: Brand) => void;
  saved: string[];
  onSave: (id: string) => void;
  onlySaved: boolean;
  onImport: () => void;
  onDemo: () => void;
  onContribute: () => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "office" | "factory">("all");
  const [category, setCategory] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const [sort, setSort] = useState("name");
  const [filters, setFilters] = useState(false);
  const categories = [...new Set(data?.brands.map((b) => b.category) ?? [])];
  const filtered = useMemo(
    () =>
      (data?.brands ?? [])
        .filter((b) => {
          const sites = relatedSites(
            data!,
            b.id,
            type === "all" ? undefined : (type as SiteType),
          );
          const searchable = [
            b.name,
            b.description,
            b.category,
            ...sites.map(
              (s) =>
                s.name +
                s.city +
                (data?.entities.find((e) => e.id === s.entityId)?.name ?? ""),
            ),
          ]
            .join(" ")
            .toLowerCase();
          return (
            (!onlySaved || saved.includes(b.id)) &&
            searchable.includes(search.toLowerCase().trim()) &&
            (category === "all" || b.category === category) &&
            (type === "all" || sites.length > 0) &&
            (schedule === "all" ||
              data!.observations.some(
                (o) =>
                  sites.some((s) => s.id === o.siteId) &&
                  o.schedule === schedule,
              ))
          );
        })
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name, "zh-CN")
            : relatedSites(data!, b.id, "factory").length -
              relatedSites(data!, a.id, "factory").length,
        ),
    [data, type, onlySaved, saved, search, category, schedule, sort],
  );
  const reset = () => {
    setSearch("");
    setCategory("all");
    setSchedule("all");
    setType("all");
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DIRECTORY</div>
          <h1>{onlySaved ? "我的收藏" : "企业与作息"}</h1>
          <p className="heading-meta">
            {data
              ? `${data.brands.length} 个品牌 · ${new Set(data.sites.map((s) => s.city)).size} 个城市`
              : "尚未载入名单"}
          </p>
        </div>
        <button className="button primary" onClick={onContribute}>
          补充企业 <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="scope-stats">
        <div>
          <span className="stat-icon teal">
            <Building2 size={22} />
          </span>
          <div>
            <span>办公室</span>
            <strong>
              {data?.sites.filter((s) => s.type === "office").length ?? 0}
              <small>处</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon blue">
            <Factory size={22} />
          </span>
          <div>
            <span>生产工厂</span>
            <strong>
              {data?.sites.filter((s) => s.type === "factory").length ?? 0}
              <small>处</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon amber">
            <Bookmark size={22} />
          </span>
          <div>
            <span>我的收藏</span>
            <strong>
              {saved.length}
              <small>个品牌</small>
            </strong>
          </div>
        </div>
        <p>
          作息按地点与岗位分别记录
          <br />
          <span>总部安排不代表工厂或供应商</span>
        </p>
      </div>
      <div className="directory-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="搜索品牌、企业或城市"
            placeholder="搜索品牌、企业或城市"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <IconButton label="清空搜索" onClick={() => setSearch("")}>
              <X size={15} />
            </IconButton>
          )}
        </div>
        <button
          className={`button quiet ${filters ? "active" : ""}`}
          onClick={() => setFilters(!filters)}
          aria-expanded={filters}
        >
          <SlidersHorizontal size={16} /> 筛选
          {(category !== "all" || schedule !== "all") && (
            <span className="filter-dot" />
          )}
        </button>
        <label className="sort-control">
          <ArrowDownWideNarrow size={16} />
          <select
            aria-label="排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">按名称排序</option>
            <option value="factories">按工厂数量</option>
          </select>
        </label>
      </div>
      {filters && (
        <div className="filter-bar">
          <label>
            品类
            <select
              aria-label="品类"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">全部品类</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            作息类型
            <select
              aria-label="作息类型"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              <option value="all">全部安排</option>
              {Object.entries(scheduleNames).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="text-button" onClick={reset}>
            重置筛选
          </button>
        </div>
      )}
      <div className="list-heading">
        <div className="segmented" aria-label="地点范围">
          {(
            [
              ["all", "全部地点"],
              ["office", "办公室"],
              ["factory", "工厂"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={type === value}
              className={type === value ? "selected" : ""}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>{filtered.length} 个结果</span>
      </div>
      <div className="directory-list">
        <div className="table-header">
          <span>品牌 / 品类</span>
          <span>办公室资料</span>
          <span>工厂资料</span>
          <span>最近观察</span>
          <span />
        </div>
        {filtered.map((brand) => {
          const offices = relatedSites(data!, brand.id, "office");
          const factories = relatedSites(data!, brand.id, "factory");
          const office = scopeSummary(data!, offices);
          const factory = scopeSummary(data!, factories);
          const siteIds = [...offices, ...factories].map((s) => s.id);
          const last = data!.observations
            .filter((o) => siteIds.includes(o.siteId))
            .map((o) => o.periodEnd)
            .sort()
            .at(-1);
          return (
            <article className="brand-row" key={brand.id}>
              <button className="brand-main" onClick={() => onSelect(brand)}>
                <BrandImage category={brand.category} />
                <span>
                  <strong>
                    {brand.name}
                    <ArrowUpRight size={14} />
                  </strong>
                  <small>
                    {brand.category} <span className="dot-sep">·</span>{" "}
                    {brand.description}
                  </small>
                </span>
              </button>
              <button className="scope-cell" onClick={() => onSelect(brand)}>
                <small className="mobile-cell-label">办公室</small>
                <Badge tone={office.tone}>{office.label}</Badge>
                <span>
                  {offices.length
                    ? `${offices.length} 处 · ${[...new Set(offices.map((s) => s.city))].join("、")}`
                    : "未收录地点"}
                </span>
              </button>
              <button className="scope-cell" onClick={() => onSelect(brand)}>
                <small className="mobile-cell-label">工厂</small>
                <Badge tone={factory.tone}>{factory.label}</Badge>
                <span>
                  {factories.length
                    ? `${factories.length} 处 · ${[...new Set(factories.map((s) => s.city))].join("、")}`
                    : "未收录地点"}
                </span>
              </button>
              <span className="row-date">{last ?? "—"}</span>
              <IconButton
                label={
                  saved.includes(brand.id)
                    ? `取消收藏 ${brand.name}`
                    : `收藏 ${brand.name}`
                }
                onClick={() => onSave(brand.id)}
                className={`icon-button bookmark ${saved.includes(brand.id) ? "is-saved" : ""}`}
              >
                <Bookmark
                  size={18}
                  fill={saved.includes(brand.id) ? "currentColor" : "none"}
                />
              </IconButton>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty-state">
            <SearchX size={38} />
            <h2>
              {data
                ? onlySaved
                  ? "还没有符合条件的收藏"
                  : "没有找到相关资料"
                : "暂无企业资料"}
            </h2>
            <p>
              {data
                ? "未收录或未找到，不代表企业不实行双休。"
                : "导入已签名名单，或载入虚构数据体验。"}
            </p>
            <div>
              {data ? (
                <button className="button quiet" onClick={reset}>
                  重置筛选
                </button>
              ) : (
                <>
                  <button className="button primary" onClick={onImport}>
                    导入名单
                  </button>
                  <button className="button quiet" onClick={onDemo}>
                    载入演示数据
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="list-footer">
        <span>共 {filtered.length} 个品牌</span>
        <span>仅展示已收录范围，未知部分不作推断</span>
      </div>
    </>
  );
}
