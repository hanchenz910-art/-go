import { useState } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  Github,
  ShieldCheck,
  KeyRound,
  Database,
  Clock3,
  FlaskConical,
  Trash2,
  Check,
  ExternalLink,
} from "lucide-react";
import { type VerifiedBundle, type TrustedKey } from "./security";
import { validSource, type GithubSource } from "./github";
import { type StoredState } from "./storage";
import { Badge } from "./components";

export default function DataSources({
  bundle,
  keys,
  source,
  onSource,
  onImport,
  onExport,
  onUpdate,
  onDemo,
  onClear,
  busy,
  state,
  notify,
}: {
  bundle?: VerifiedBundle;
  keys: TrustedKey[];
  source: GithubSource;
  onSource: (source: GithubSource) => void;
  onImport: () => void;
  onExport: () => void;
  onUpdate: () => void;
  onDemo: () => void;
  onClear: () => void;
  busy: boolean;
  state: StoredState;
  notify: (message: string, error?: boolean) => void;
}) {
  const [draft, setDraft] = useState(source);
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DATA & TRUST</div>
          <h1>数据与更新</h1>
          <p className="heading-meta">本地保存 · 签名验证 · 独立数据仓库</p>
        </div>
        <ShieldCheck className="heading-icon" size={30} />
      </div>
      <section className="settings-section">
        <div className="section-heading">
          <h2>
            <Database size={19} />
            当前名单
          </h2>
          {bundle && (
            <Badge tone={bundle.expired ? "amber" : "teal"}>
              {bundle.expired ? "签名有效 · 名单已过期" : "签名有效"}
            </Badge>
          )}
        </div>
        {bundle ? (
          <>
            <dl className="dataset-facts">
              <div>
                <dt>数据集</dt>
                <dd>
                  {bundle.data.datasetId}{" "}
                  {bundle.data.environment === "demo" && (
                    <span className="inline-demo">演示</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>版本序号</dt>
                <dd>v{bundle.data.sequence}</dd>
              </div>
              <div>
                <dt>签发日期</dt>
                <dd>
                  {new Date(bundle.data.publishedAt).toLocaleString("zh-CN", {
                    hour12: false,
                  })}
                </dd>
              </div>
              <div>
                <dt>名单有效至</dt>
                <dd>
                  {new Date(bundle.data.expiresAt).toLocaleString("zh-CN", {
                    hour12: false,
                  })}
                </dd>
              </div>
              <div>
                <dt>签名密钥</dt>
                <dd>{bundle.key.id}</dd>
              </div>
              <div>
                <dt>内容摘要 SHA-256</dt>
                <dd className="digest">{bundle.digest}</dd>
              </div>
            </dl>
            <div className="notice compact">
              <ShieldCheck size={17} />
              <span>
                签名证明由对应密钥签发且内容完整；签发日期由维护者声明，不代表第三方授时或事实认证。
              </span>
            </div>
          </>
        ) : (
          <div className="missing-record">
            当前没有名单，可导入文件或从已配置的 GitHub 仓库更新。
          </div>
        )}
        <div className="settings-actions">
          <button className="button primary" disabled={busy} onClick={onImport}>
            <Upload size={16} />
            导入名单
          </button>
          <button
            className="button quiet"
            disabled={!bundle || busy}
            onClick={onExport}
          >
            <Download size={16} />
            导出原签名文件
          </button>
          <button
            className="text-button danger"
            disabled={!bundle || busy}
            onClick={onClear}
          >
            <Trash2 size={15} />
            清除当前名单
          </button>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>
            <Github size={19} />
            GitHub 数据仓库
          </h2>
          <Badge tone={validSource(source) ? "teal" : "muted"}>
            {validSource(source) ? "已配置" : "未配置"}
          </Badge>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!validSource(draft)) {
              notify("仓库信息格式无效，请检查所有者、仓库和分支", true);
              return;
            }
            onSource(draft);
          }}
        >
          <div className="form-grid">
            <label>
              所有者
              <input
                aria-label="GitHub 所有者"
                autoComplete="off"
                value={draft.owner}
                maxLength={39}
                onChange={(e) =>
                  setDraft((s) => ({ ...s, owner: e.target.value.trim() }))
                }
                placeholder="organization 或 username"
              />
            </label>
            <label>
              数据仓库
              <input
                aria-label="GitHub 数据仓库"
                autoComplete="off"
                value={draft.repo}
                maxLength={100}
                onChange={(e) =>
                  setDraft((s) => ({ ...s, repo: e.target.value.trim() }))
                }
                placeholder="weekend-data"
              />
            </label>
            <label>
              分支
              <input
                aria-label="GitHub 分支"
                value={draft.branch}
                maxLength={120}
                onChange={(e) =>
                  setDraft((s) => ({ ...s, branch: e.target.value.trim() }))
                }
              />
            </label>
            <div className="read-only-field">
              <span>名单路径</span>
              <code>releases/latest.sxlist.json</code>
            </div>
          </div>
          <div className="settings-actions">
            <button className="button quiet" type="submit">
              <Check size={16} />
              保存仓库
            </button>
            <button
              className="button primary"
              type="button"
              onClick={onUpdate}
              disabled={busy || !validSource(source)}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              检查更新
            </button>
          </div>
        </form>
        <p className="section-note">
          连接失败时可使用本地文件。更换仓库不会新增可信公钥，也不会绕过签名或版本检查。
        </p>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>
            <KeyRound size={19} />
            可信签发者
          </h2>
        </div>
        {keys.map((key) => (
          <div className="key-row" key={key.id}>
            <ShieldCheck size={21} />
            <div>
              <strong>{key.id}</strong>
              <p>
                {key.purpose === "demo" ? "仅可签发演示数据" : "可签发正式名单"}{" "}
                · 有效至 {key.notAfter.slice(0, 10)}
              </p>
              <code>{key.publicKey}</code>
            </div>
            <Badge tone={key.purpose === "demo" ? "amber" : "teal"}>
              {key.purpose === "demo" ? "演示公钥" : "正式公钥"}
            </Badge>
          </div>
        ))}
        <p className="section-note">
          可信公钥随应用发布。名单文件不能自行添加公钥；更换或撤销密钥需要可信应用更新。
        </p>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>
            <Clock3 size={19} />
            本机更新记录
          </h2>
          <span>最近 20 次</span>
        </div>
        {state.history.length ? (
          state.history.map((entry, index) => (
            <div className="history-row" key={entry.digest + index}>
              <span className="timeline-dot" />
              <div>
                <strong>
                  {entry.source}{" "}
                  <span>
                    · {entry.datasetId} v{entry.sequence}
                  </span>
                </strong>
                <p>
                  {new Date(entry.date).toLocaleString("zh-CN", {
                    hour12: false,
                  })}
                </p>
              </div>
              <ShieldCheck size={17} />
            </div>
          ))
        ) : (
          <p className="section-note">暂无更新记录。</p>
        )}
      </section>
      <section className="settings-section demo-section">
        <div>
          <h2>
            <FlaskConical size={19} />
            演示数据
          </h2>
          <p>全部企业、工厂与作息均为虚构，不构成初始真实名单。</p>
        </div>
        <button className="button quiet" onClick={onDemo} disabled={busy}>
          载入演示 <ExternalLink size={15} />
        </button>
      </section>
    </div>
  );
}
