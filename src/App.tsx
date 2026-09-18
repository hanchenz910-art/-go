import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  LayoutList,
  Bookmark,
  Database,
  MessageSquarePlus,
  Scale,
  Upload,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  X,
  WifiOff,
  Menu,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import trustedKeysJson from "./trusted-keys.json";
import {
  verifyBundle,
  preventRollback,
  readListFile,
  type TrustedKey,
  type VerifiedBundle,
} from "./security";
import {
  acceptBundle,
  clearDataset,
  downloadFile,
  readState,
  watermarkKey,
  type StoredState,
} from "./storage";
import {
  emptySource,
  fetchLatest,
  validSource,
  type GithubSource,
  type Contribution,
} from "./github";
import { type Brand, type Site } from "./model";
import { Badge, IconButton } from "./components";
import Directory from "./Directory";
import BrandDetail from "./BrandDetail";
import DataSources from "./DataSources";
import Contribute from "./Contribute";
import Rules from "./Rules";

type View = "directory" | "saved" | "data" | "contribute" | "rules";
const nav = [
  ["directory", "企业目录", LayoutList],
  ["saved", "我的收藏", Bookmark],
  ["data", "数据与更新", Database],
  ["contribute", "参与共建", MessageSquarePlus],
  ["rules", "收录规则", Scale],
] as const;
const keys = trustedKeysJson as TrustedKey[];
const emptyState: StoredState = { highWaters: {}, history: [] };
function loadPreference<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(name) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [view, setView] = useState<View>("directory");
  const [mobileNav, setMobileNav] = useState(false);
  const [bundle, setBundle] = useState<VerifiedBundle>();
  const [state, setState] = useState<StoredState>(emptyState);
  const stateRef = useRef(state);
  const bundleRef = useRef(bundle);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(
    () => loadPreference<boolean>("rest-evidence:auto-update", false) === true,
  );
  const operation = useRef(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [source, setSource] = useState<GithubSource>(() => {
    const saved = loadPreference<GithubSource>(
      "rest-evidence:source",
      emptySource,
    );
    return validSource(saved) ? saved : emptySource;
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = loadPreference<unknown>("rest-evidence:favorites", []);
    return Array.isArray(saved)
      ? saved.filter((v) => typeof v === "string")
      : [];
  });
  const [selected, setSelected] = useState<Brand>();
  const [draft, setDraft] = useState<Partial<Contribution>>();
  const [draftId, setDraftId] = useState(0);
  const [toast, setToast] = useState<{ text: string; error: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = (text: string, error = false) => setToast({ text, error });
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(undefined), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = readState();
        let verified: VerifiedBundle | undefined;
        if (stored.raw) {
          verified = await verifyBundle(stored.raw, keys);
          preventRollback(verified, stored.highWaters[watermarkKey(verified)]);
        } else if (!stored.initialized) {
          const response = await fetch(
            import.meta.env.BASE_URL + "demo.sxlist.json",
          );
          if (!response.ok) throw new Error("演示名单暂不可用，请导入本地文件");
          verified = await verifyBundle(await response.text(), keys);
        }
        if (cancelled) return;
        const next = verified
          ? acceptBundle(stored, verified, stored.raw ? "本地缓存" : "内置演示")
          : stored;
        stateRef.current = next;
        bundleRef.current = verified;
        setState(next);
        setBundle(verified);
      } catch (error) {
        if (!cancelled) notify((error as Error).message, true);
      } finally {
        if (!cancelled) {
          setBusy(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function ingest(raw: string, label: string, allowDemoSwitch = false) {
    const verified = await verifyBundle(raw, keys);
    const current = bundleRef.current;
    if (
      current?.data.environment === "production" &&
      verified.data.environment === "demo" &&
      !allowDemoSwitch
    )
      throw new Error("不能用演示名单覆盖正式名单，请在数据页明确选择演示模式");
    if (
      current?.data.environment === "production" &&
      verified.data.environment === "production" &&
      current.data.datasetId !== verified.data.datasetId
    )
      throw new Error("数据集标识不同，请先清除当前名单后再导入");
    const next = acceptBundle(stateRef.current, verified, label);
    stateRef.current = next;
    bundleRef.current = verified;
    setState(next);
    setBundle(verified);
    setSelected(undefined);
    notify(
      verified.expired
        ? "签名有效，名单已过期；仅供历史查阅，请更新"
        : `已验证并载入 v${verified.data.sequence}，共 ${verified.data.brands.length} 个品牌`,
    );
  }
  async function run(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      notify((error as Error).message || "操作失败，原数据保持不变", true);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0 });
  };
  const update = () => {
    if (!validSource(source)) {
      navigate("data");
      notify("请先设置 GitHub 数据仓库");
      return;
    }
    void run(async () => ingest(await fetchLatest(source), "GitHub 更新"));
  };
  const demo = () =>
    void run(async () => {
      const response = await fetch(
        import.meta.env.BASE_URL + "demo.sxlist.json",
      );
      if (!response.ok) throw new Error("演示名单不可用");
      await ingest(await response.text(), "内置演示", true);
    });
  useEffect(() => {
    if (!ready || !autoUpdate || !validSource(source)) return;
    const check = () => {
      if (navigator.onLine) update();
    };
    check();
    const timer = setInterval(check, 15 * 60 * 1000);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, [ready, autoUpdate, source]);
  const contribute = (brand?: Brand, site?: Site) => {
    setDraft(
      brand
        ? {
            brand: brand.name,
            company: site
              ? bundle?.data.entities.find((e) => e.id === site.entityId)?.name
              : "",
            siteType: site?.type ?? "office",
            site: site?.name ?? "",
            city: site?.city ?? "",
            kind: "feedback",
          }
        : { kind: "add" },
    );
    setDraftId((id) => id + 1);
    setSelected(undefined);
    navigate("contribute");
  };
  const datasetPrefix = (bundle?.data.datasetId ?? "") + ":";
  const saved = favorites
    .filter((v) => v.startsWith(datasetPrefix))
    .map((v) => v.slice(datasetPrefix.length))
    .filter((id) => bundle?.data.brands.some((b) => b.id === id));
  const toggleFavorite = (id: string) => {
    const key = datasetPrefix + id;
    const next = favorites.includes(key)
      ? favorites.filter((v) => v !== key)
      : [...favorites, key];
    try {
      localStorage.setItem("rest-evidence:favorites", JSON.stringify(next));
      setFavorites(next);
    } catch {
      notify("浏览器无法保存收藏，请检查存储权限", true);
    }
  };
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="关闭导航"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="app-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("directory");
          }}
        >
          <span className="brand-symbol">
            <CalendarCheck2 size={26} />
          </span>
          <span>
            <strong>休息有据</strong>
            <small>REST, WITH EVIDENCE</small>
          </span>
        </a>
        <div className="nav-caption">工作台</div>
        <nav>
          {nav.map(([value, label, Icon]) => (
            <button
              key={value}
              className={`nav-item ${view === value ? "selected" : ""}`}
              aria-current={view === value ? "page" : undefined}
              onClick={() => navigate(value)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {value === "saved" && saved.length > 0 && (
                <small>{saved.length}</small>
              )}
              {view === value && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-divider" />
          <div>
            <ShieldCheck size={18} />
            <span>公开来源 · 独立核验</span>
          </div>
          <p>
            让每一条休息安排
            <br />
            都有据可查。
          </p>
          <small>
            v0.1.0 <span>本地优先</span>
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="打开导航"
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={21} />
            </IconButton>
            <span>工作台</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n[0] === view)?.[1]}</strong>
          </div>
          <div className="topbar-actions">
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                aria-label="自动更新名单"
                checked={autoUpdate}
                onChange={(e) => {
                  try {
                    localStorage.setItem(
                      "rest-evidence:auto-update",
                      JSON.stringify(e.target.checked),
                    );
                    setAutoUpdate(e.target.checked);
                  } catch {
                    notify("无法保存自动更新设置", true);
                  }
                }}
              />{" "}
              自动更新
            </label>
            {offline && (
              <span className="offline-label">
                <WifiOff size={15} />
                离线
              </span>
            )}
            <button
              className="button quiet"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Upload size={15} />
              <span>导入名单</span>
            </button>
            <button
              className="button top-update"
              onClick={update}
              disabled={busy}
            >
              <RefreshCw size={15} className={busy ? "spin" : ""} />
              <span>{busy ? "处理中" : "检查更新"}</span>
            </button>
          </div>
        </header>
        <input
          ref={fileInput}
          data-testid="file-import"
          type="file"
          accept=".json,.sxlist,application/json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              void run(async () =>
                ingest(await readListFile(file), "本地文件导入"),
              );
          }}
        />
        {bundle?.data.environment === "demo" && (
          <div className="demo-banner">
            <FlaskConical size={16} />
            <span>
              <strong>演示数据</strong>
              <span className="demo-banner-detail">
                {" "}
                · 所有企业、地点与作息均为虚构
              </span>
            </span>
            <button onClick={() => navigate("data")}>
              管理数据 <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {bundle?.expired && (
          <div className="expired-banner">
            <AlertCircle size={16} />
            名单已过期，仅供历史查阅。签名有效不代表资料仍然适用。
          </div>
        )}
        <main>
          {(view === "directory" || view === "saved") && (
            <Directory
              data={bundle?.data}
              onlySaved={view === "saved"}
              saved={saved}
              onSave={toggleFavorite}
              onSelect={setSelected}
              onImport={() => fileInput.current?.click()}
              onDemo={demo}
              onContribute={() => contribute()}
            />
          )}
          {view === "data" && (
            <DataSources
              bundle={bundle}
              keys={keys}
              source={source}
              onSource={(next) => {
                try {
                  localStorage.setItem(
                    "rest-evidence:source",
                    JSON.stringify(next),
                  );
                  setSource(next);
                  notify("数据与投稿仓库已保存");
                } catch {
                  notify("浏览器无法保存仓库设置", true);
                }
              }}
              onImport={() => fileInput.current?.click()}
              onExport={() => {
                if (bundle)
                  downloadFile(
                    `${bundle.data.datasetId}-v${bundle.data.sequence}.sxlist.json`,
                    JSON.stringify(bundle.envelope, null, 2),
                  );
              }}
              onUpdate={update}
              onDemo={demo}
              onClear={() => {
                try {
                  const next = clearDataset(stateRef.current);
                  stateRef.current = next;
                  bundleRef.current = undefined;
                  setState(next);
                  setBundle(undefined);
                  notify("已清除当前名单，已见版本记录仍保留");
                } catch {
                  notify("无法清除本地存储", true);
                }
              }}
              state={state}
              notify={notify}
              busy={busy}
            />
          )}
          {view === "contribute" && (
            <Contribute
              key={draftId}
              initial={draft}
              source={source}
              onSettings={() => navigate("data")}
              onDraftChange={setDraft}
              notify={notify}
            />
          )}
          {view === "rules" && <Rules />}
        </main>
        <footer className="workspace-footer">
          <span>
            <ShieldCheck size={14} />
            {bundle
              ? `签名已验证 · v${bundle.data.sequence}`
              : "暂无已验证名单"}
          </span>
          <span>
            {bundle
              ? `签发 ${bundle.data.publishedAt.slice(0, 10)}`
              : "支持离线文件导入"}
            <span className="footer-divider">/</span>资料仅适用于列明范围
          </span>
        </footer>
      </div>
      {selected && bundle && (
        <BrandDetail
          brand={selected}
          data={bundle.data}
          onClose={() => setSelected(undefined)}
          onFeedback={contribute}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <IconButton label="关闭提示" onClick={() => setToast(undefined)}>
            <X size={17} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
