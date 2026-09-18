# 休息有据

按品牌、经营主体、办公室、工厂、岗位和时间范围查阅作息资料的本地优先应用。

当前版本是可运行的功能基础版。**没有建立真实初始企业名单**；内置 8 个虚构品牌、8 个办公室和 9 个工厂，仅用于测试和界面演示。所有页面均标注演示身份。

## 本地运行

要求 Node.js 22.18+ 或 24+。签名命令依赖 Node 的原生 TypeScript 类型擦除能力；建议使用 Node.js 24。

```powershell
npm ci
npm run dev -- --port 4173
```

访问终端显示的本地地址。构建生产版本：

```powershell
npm run build
npm run preview -- --port 4176
```

PWA 离线缓存只在生产构建中启用。第一次在线打开并完成缓存后，才能断网重新打开。首次在完全断网的设备上访问一个从未安装的网站无法启动；本地文件导入只负责导入名单，不会安装 App。

## 已实现

- 品牌搜索、城市搜索、品类与作息筛选、办公室 / 工厂范围、收藏。
- 多经营主体、多地点、多对多品牌与工厂关系；办公室作息不继承给工厂。
- 具体岗位、用工类型、观察期间、公开制度 / 招聘口径 / 反馈分开记录。
- 淘宝、天猫、京东、拼多多购物链接校验；实体门店地址、复制和正式数据的地图链接。
- 本地名单导入、原签名导出、本地缓存、数据清除和更新记录。
- Ed25519 验签、SHA-256 内容摘要、可信密钥用途校验、日期检查、过期提示、防止本机已见版本回退。
- 从配置的 GitHub 数据仓库拉取 `releases/latest.sxlist.json`，与本地导入共用验签流程。
- 结构化补充企业、作息反馈、资料更正与企业异议；生成 GitHub Issue 预填链接或下载 Markdown 草稿。
- 不内置 GitHub Token；点击前往 GitHub 只打开表单，由用户在 GitHub 最终确认发布。
- 公开投稿提示、个人信息初步检测、来源约束和收录规则。

## 代码与数据分离

建议独立建立两个 GitHub 仓库：

| 仓库 | 内容 |
| --- | --- |
| `rest-evidence-app` | 本仓库的客户端、Schema、公开验签密钥与签发工具 |
| `weekend-data` | 经审核的公开事实、资料来源、待审核 Issues、签名名单 |

App 的“数据与更新”页面配置第二个仓库。**配置一个仓库地址不代表信任它的密钥**；客户端只接受内置可信公钥签发的名单。

示范数据和测试样本可随代码分发。真实资料不应写死在 App 中。私钥、私人举证材料、员工身份材料不能放进上述公开仓库。

数据仓库推荐结构：

```text
weekend-data/
  .github/ISSUE_TEMPLATE/    # 使用本项目提供的投稿模板
  candidates/               # 仅含可公开、待核实的线索；客户端不读取
  approved/dataset.json     # 经人工审核的正文
  releases/latest.sxlist.json
  POLICY.md                 # 审核、投诉及更正流程
```

## 签发正式名单

当前 App 只有演示公钥。真实数据接入前由维护者生成独立正式密钥：

```powershell
npm run keys:init -- --id maintainer-2026 --purpose production
```

命令会把私钥保存到已被 Git 忽略的 `.local/keys/maintainer-2026.pem`，把公钥加入 `src/trusted-keys.json`。请在安全环境中妥善备份私钥；Windows 上需同时管理文件 ACL，文件生成参数不能代替实际操作系统权限。

1. 在数据仓库准备符合 `src/model.ts` 的正文，将 `environment` 设为 `production`。每条正式证据需要公开 HTTPS 来源，演示证据不能进入正式名单。
2. 每次发布增加 `sequence`，更新 `publishedAt` 与 `expiresAt`。同一 `datasetId` 的版本号必须单调增加，不能用同一版本号发布不同内容。
3. 在受信任维护环境运行签发工具：

```powershell
npm run data:sign -- --input ../weekend-data/approved/dataset.json --key .local/keys/maintainer-2026.pem --key-id maintainer-2026 --out ../weekend-data/releases/latest.sxlist.json
```

4. 审核并发布包含新公钥的 App，再把**签名名单文件**发布到数据仓库。不要上传 `.local` 或 PEM 文件。
5. 用户可以更新 GitHub 数据，或通过任意方式取得签名文件再离线导入。

生产签名工具只校验结构和密钥，不自动证明资料真实。人工核验仍然必需。

## 测试

```powershell
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

自动化覆盖密码学边界、Schema、地点范围、平台链接、网络错误、隐私提示、完整导入流程、投稿预填链接和桌面 / 手机布局。GitHub 集成测试使用拦截的 HTTP 响应及表单页，**不会向真实 GitHub 提交 Issue 或推送数据**。

签名演示文件已随仓库保存，普通运行无需执行 `demo:build`。该维护命令需要本机已有演示私钥；克隆仓库不包含此私钥。正式签发不得复用演示密钥。

## 文档与限制

- [数据协议与信任边界](docs/ARCHITECTURE.md)
- [法律风险与运营约束](docs/LEGAL.md)
- [图像来源](docs/ASSETS.md)

当前没有配置真实 GitHub 数据仓库，没有真实企业名单，也没有正式运营主体、私密申诉受理渠道或法律审核结论。基础功能可本地验证；公开运营前须完成上述配置与审核。

本项目尚未选定正式发布的开源许可证。参考项目的代码许可与第三方数据权利必须分别核对，不能将其他项目的名单视为已经核实的事实。
