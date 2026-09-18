import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FileDown,
  Github,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  contributionKinds,
  emptyContribution,
  issueBody,
  issueUrl,
  validateContribution,
  validSource,
  type Contribution,
  type GithubSource,
} from "./github";
import { siteNames, scheduleNames } from "./model";
import { downloadFile } from "./storage";

export default function Contribute({
  initial,
  source,
  onSettings,
  onDraftChange,
  notify,
}: {
  initial?: Partial<Contribution>;
  source: GithubSource;
  onSettings: () => void;
  onDraftChange: (draft: Partial<Contribution>) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [form, setForm] = useState<Contribution>({
    ...emptyContribution,
    ...initial,
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    onDraftChange(form);
  }, [form, onDraftChange]);
  const change = (key: keyof Contribution, value: string) =>
    setForm((c) => ({ ...c, [key]: value }));
  const validate = () => {
    const error = validateContribution(form);
    if (error) {
      notify(error, true);
      return false;
    }
    if (!acknowledged) {
      notify("请确认已了解公开投稿与信息范围", true);
      return false;
    }
    return true;
  };
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTRIBUTE</div>
          <h1>参与共建</h1>
          <p className="heading-meta">一条资料，对应一个具体地点和时间范围</p>
        </div>
        <Github size={28} className="heading-icon" />
      </div>
      <div className="notice amber">
        <Info size={19} />
        <div>
          <strong>GitHub Issue 会公开显示</strong>
          <p>
            不要提交姓名、手机号、工牌、考勤原件或未公开内部文件。账户和文字内容可能识别投稿者，Issue
            不提供匿名保护。
          </p>
        </div>
      </div>
      <form
        className="contribution-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validate()) return;
          try {
            const url = issueUrl(source, form);
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (error) {
            notify((error as Error).message, true);
          }
        }}
      >
        <fieldset>
          <legend>
            01 <span>投稿类型</span>
          </legend>
          <div className="contribution-kinds">
            {Object.entries(contributionKinds).map(([key, label]) => (
              <label key={key}>
                <input
                  type="radio"
                  name="kind"
                  checked={form.kind === key}
                  onChange={() => change("kind", key)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            02 <span>企业与地点</span>
          </legend>
          <div className="form-grid">
            <label>
              品牌名称
              <input
                required
                maxLength={100}
                value={form.brand}
                onChange={(e) => change("brand", e.target.value)}
                placeholder="企业或品牌的公开名称"
              />
            </label>
            <label>
              经营主体
              <input
                required
                maxLength={120}
                value={form.company}
                onChange={(e) => change("company", e.target.value)}
                placeholder="具体法人或经营主体"
              />
            </label>
            <label>
              地点类型
              <select
                aria-label="地点类型"
                value={form.siteType}
                onChange={(e) => change("siteType", e.target.value)}
              >
                {Object.entries(siteNames).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              城市
              <input
                required
                maxLength={80}
                value={form.city}
                onChange={(e) => change("city", e.target.value)}
                placeholder="例如：杭州市"
              />
            </label>
            <label className="span-two">
              具体办公室 / 厂区 / 门店
              <input
                required
                maxLength={160}
                value={form.site}
                onChange={(e) => change("site", e.target.value)}
                placeholder="不能仅填写整个集团"
              />
            </label>
            <label>
              部门或岗位
              <input
                required
                maxLength={100}
                value={form.role}
                onChange={(e) => change("role", e.target.value)}
                placeholder="例如：生产操作岗"
              />
            </label>
            <label>
              用工类型
              <select
                aria-label="用工类型"
                value={form.employment}
                onChange={(e) => change("employment", e.target.value)}
              >
                {["直接用工", "劳务派遣", "外包用工", "不清楚"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>
            03 <span>作息事实与公开来源</span>
          </legend>
          <div className="form-grid">
            <label className="span-two">
              作息安排
              <select
                aria-label="作息安排"
                value={form.schedule}
                onChange={(e) => change("schedule", e.target.value)}
              >
                {Object.entries(scheduleNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              观察开始日期
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={form.start}
                onChange={(e) => change("start", e.target.value)}
              />
            </label>
            <label>
              观察结束日期
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={form.end}
                onChange={(e) => change("end", e.target.value)}
              />
            </label>
            <label className="span-two">
              公开来源链接
              <input
                type="url"
                required
                maxLength={1600}
                value={form.source}
                onChange={(e) => change("source", e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="span-two">
              补充说明{" "}
              <span className="field-optional">
                选填 · {form.note.length}/500
              </span>
              <textarea
                rows={4}
                maxLength={500}
                value={form.note}
                onChange={(e) => change("note", e.target.value)}
                placeholder="区分招聘承诺、公开制度与实际观察。只描述此地点、岗位和期间。"
              />
            </label>
          </div>
        </fieldset>
        <label className="acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            我已了解内容将公开，只提交必要事实和公开来源，不包含个人敏感信息；资料须经维护者审核后才能进入签名名单。
          </span>
        </label>
        {!validSource(source) && (
          <div className="notice compact">
            <Info size={16} />
            <span>尚未设置投稿仓库。</span>
            <button type="button" className="text-button" onClick={onSettings}>
              设置 GitHub 仓库 <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        <div className="form-actions">
          <button className="button primary" type="submit">
            <Github size={17} />
            前往 GitHub 确认发布 <ArrowUpRight size={15} />
          </button>
          <button
            type="button"
            className="button quiet"
            onClick={() => {
              if (validate())
                downloadFile(
                  "作息资料草稿.md",
                  issueBody(form),
                  "text/markdown",
                );
            }}
          >
            <FileDown size={17} />
            下载草稿
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "收起预览" : "预览投稿"}
          </button>
        </div>
        {preview && <pre className="issue-preview">{issueBody(form)}</pre>}
      </form>
      <div className="review-flow">
        <CheckCircle2 size={18} />
        <span>提交线索</span>
        <span>→</span>
        <span>来源核查</span>
        <span>→</span>
        <span>维护者审核</span>
        <span>→</span>
        <span>签名发布</span>
      </div>
    </div>
  );
}
