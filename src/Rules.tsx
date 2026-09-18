import {
  Scale,
  FileCheck2,
  ShieldCheck,
  UserRound,
  GitPullRequest,
  ExternalLink,
} from "lucide-react";
import { ExternalLinkButton } from "./components";

export default function Rules() {
  return (
    <div className="narrow-page rules">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EDITORIAL POLICY</div>
          <h1>收录与更正规则</h1>
          <p className="heading-meta">资料有范围，结论有边界</p>
        </div>
        <Scale className="heading-icon" size={29} />
      </div>
      <section className="settings-section">
        <h2>
          <FileCheck2 size={20} />
          按地点、岗位和期间收录
        </h2>
        <p>
          每条作息资料必须关联具体经营主体、办公室或厂区、岗位、用工类型和适用时间。品牌总部、直营工厂、合作工厂、门店和派遣员工分别记录。未收录、来源不足或资料过期均不代表不双休。
        </p>
        <div className="definition-list">
          <div>
            <strong>周六日双休</strong>
            <span>通常周六、周日休息，例外安排需单独说明。</span>
          </div>
          <div>
            <strong>每周休两日</strong>
            <span>每周安排两日休息，但不一定在周末或连续。</span>
          </div>
          <div>
            <strong>大小周 / 单休 / 轮班</strong>
            <span>客观描述作息类型，不直接认定违法。</span>
          </div>
          <div>
            <strong>招聘口径</strong>
            <span>仅说明公开招聘资料如此表述，不证明实际执行。</span>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>
          <GitPullRequest size={20} />
          审核与异议
        </h2>
        <p>
          公开线索经来源核查、范围核对和人工审核后，才进入签名发布文件。点赞数量、GitHub
          账户数量与未找到负面消息，均不能代替核验。
        </p>
        <p>
          企业和投稿者可提交资料更正、反证或异议。对明显失实、隐私泄露或其他侵权风险，维护者应及时采取删除、屏蔽或断开链接等必要措施，记录理由，通知相关方并依法处理反通知。争议信息不作为已核实结论传播。
        </p>
        <p>
          公开页面仅保留必要的事实摘要与来源。私人身份材料不得放进公开
          Issue；需要私密举证时，应通过运营者另行公布的合规渠道办理。当前演示版不接收私人材料。
        </p>
      </section>
      <section className="settings-section">
        <h2>
          <UserRound size={20} />
          隐私与公开仓库
        </h2>
        <p>
          本应用不要求登录，收藏和名单保存在当前浏览器。GitHub、购物平台和地图链接由各服务提供；访问时适用对方规则。公开
          Issue 会暴露 GitHub 账户与投稿内容，可能被索引、复制和保留。
        </p>
        <p>
          请勿上传身份证、手机号、员工名单、工牌、未脱敏截图、考勤原件、精确个人行踪或商业秘密。简单遮挡姓名不一定能够匿名化。撤回公开内容也不能保证删除他人副本和已下载的离线名单。
        </p>
      </section>
      <section className="settings-section">
        <h2>
          <ShieldCheck size={20} />
          签名与时效
        </h2>
        <p>
          App 使用内置公钥验证名单的 Ed25519
          签名。名单正文、版本和签发日期均受保护；私钥由维护者保管，不进入客户端或公开仓库。
        </p>
        <p>
          有效签名不证明资料真实、不证明企业全员双休，也不保证离线名单是最新版本。签发日期是签发者声明的日期，设备时钟和离线环境都有局限。过期名单明确提示；本机已见的旧版本不能覆盖较新版本。
        </p>
      </section>
      <section className="settings-section">
        <h2>
          <Scale size={20} />
          法律依据与产品边界
        </h2>
        <p>
          本项目提供事实资料索引，不作劳动争议裁判，不授予“守法认证”，不收取排名、删评或推荐费用。仅链接主流购物平台与公开门店位置；渠道收录不构成品牌合作或质量担保。开源、境外托管及免责声明均不能免除运营者依法应承担的责任。
        </p>
        <div className="legal-links">
          <ExternalLinkButton href="https://www.court.gov.cn/zixun/xiangqing/233181.html">
            民法典：名誉权、合理核实与网络侵权
          </ExternalLinkButton>
          <ExternalLinkButton href="https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250310_1958923.html">
            个人信息保护法
          </ExternalLinkButton>
          <ExternalLinkButton href="https://www.cnipa.gov.cn/art/2026/5/20/art_104_206437.html">
            反不正当竞争法（2025 年修订）
          </ExternalLinkButton>
          <ExternalLinkButton href="https://rst.fujian.gov.cn/wz/cjwt/ldgx/xxxj/202311/t20231113_6295199.htm">
            福建省人社厅：工作时间规定
          </ExternalLinkButton>
        </div>
        <p className="section-note">
          运营主体、备案、信息出境、投诉受理与商业合作的具体义务，须在正式公开运营前结合实际模式由中国执业律师核查。
        </p>
      </section>
    </div>
  );
}
