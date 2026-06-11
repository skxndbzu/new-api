package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type LegalSettings struct {
	UserAgreement string `json:"user_agreement"`
	PrivacyPolicy string `json:"privacy_policy"`
}

type LocalizedLegalDocument map[string]string

var defaultLegalSettings = LegalSettings{
	UserAgreement: defaultUserAgreementZh,
	PrivacyPolicy: defaultPrivacyPolicyZh,
}

func init() {
	config.GlobalConfig.Register("legal", &defaultLegalSettings)
}

func GetLegalSettings() *LegalSettings {
	return &defaultLegalSettings
}

func GetEffectiveUserAgreement() string {
	return fallbackLegalContent(defaultLegalSettings.UserAgreement, defaultUserAgreementZh)
}

func GetEffectivePrivacyPolicy() string {
	return fallbackLegalContent(defaultLegalSettings.PrivacyPolicy, defaultPrivacyPolicyZh)
}

func GetEffectiveUserAgreementDocuments() LocalizedLegalDocument {
	return localizedLegalContent(defaultLegalSettings.UserAgreement, defaultUserAgreementZh, defaultUserAgreementEn)
}

func GetEffectivePrivacyPolicyDocuments() LocalizedLegalDocument {
	return localizedLegalContent(defaultLegalSettings.PrivacyPolicy, defaultPrivacyPolicyZh, defaultPrivacyPolicyEn)
}

func fallbackLegalContent(content, fallback string) string {
	if strings.TrimSpace(content) == "" {
		return fallback
	}
	return content
}

func localizedLegalContent(content, zhFallback, enFallback string) LocalizedLegalDocument {
	content = strings.TrimSpace(content)
	if content == "" || content == strings.TrimSpace(zhFallback) {
		return LocalizedLegalDocument{
			"zh": zhFallback,
			"en": enFallback,
		}
	}

	var localized LocalizedLegalDocument
	if err := common.UnmarshalJsonStr(content, &localized); err == nil && len(localized) > 0 {
		if strings.TrimSpace(localized["zh"]) == "" {
			localized["zh"] = zhFallback
		}
		if strings.TrimSpace(localized["en"]) == "" {
			localized["en"] = localized["zh"]
		}
		return localized
	}

	return LocalizedLegalDocument{
		"zh": content,
		"en": content,
	}
}

const legalDocumentStyle = `<style>
.legal-doc {
  --legal-border: #e5e7eb;
  --legal-muted: #64748b;
  --legal-soft: #f8fafc;
  --legal-accent: #0284c7;
  --legal-ink: #0f172a;
  color: var(--legal-ink);
  max-width: 920px;
  margin: 0 auto;
}
.legal-doc .legal-hero {
  border: 1px solid var(--legal-border);
  border-radius: 18px;
  padding: 28px;
  background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 58%, #f8fafc 100%);
}
.legal-doc .legal-kicker {
  margin: 0 0 10px;
  color: var(--legal-accent);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.legal-doc h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
}
.legal-doc .legal-meta {
  margin: 14px 0 0;
  color: var(--legal-muted);
}
.legal-doc .legal-alert {
  margin: 22px 0 0;
  border-left: 4px solid var(--legal-accent);
  border-radius: 10px;
  padding: 14px 16px;
  background: rgba(2, 132, 199, .08);
}
.legal-doc .legal-toc {
  margin: 26px 0 34px;
  border: 1px solid var(--legal-border);
  border-radius: 14px;
  padding: 20px 22px;
  background: var(--legal-soft);
}
.legal-doc .legal-toc h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
.legal-doc .legal-toc ol {
  columns: 2;
  gap: 34px;
  margin: 0;
  padding-left: 20px;
}
.legal-doc .legal-toc li {
  break-inside: avoid;
  margin: 6px 0;
}
.legal-doc .legal-section {
  border-top: 1px solid var(--legal-border);
  padding-top: 26px;
  margin-top: 26px;
}
.legal-doc .legal-section h2 {
  margin-top: 0;
  font-size: 24px;
}
.legal-doc .legal-section h3 {
  margin-top: 22px;
  font-size: 18px;
}
.legal-doc p,
.legal-doc li {
  line-height: 1.78;
}
.legal-doc strong {
  font-weight: 700;
}
.legal-doc a {
  color: var(--legal-accent);
}
@media (max-width: 720px) {
  .legal-doc .legal-hero { padding: 22px; }
  .legal-doc .legal-toc ol { columns: 1; }
}
@media (prefers-color-scheme: dark) {
  .legal-doc {
    --legal-border: #334155;
    --legal-muted: #94a3b8;
    --legal-soft: #0f172a;
    --legal-accent: #38bdf8;
    --legal-ink: #e5e7eb;
  }
  .legal-doc .legal-hero {
    background: linear-gradient(135deg, rgba(14,165,233,.16), rgba(15,23,42,.55));
  }
  .legal-doc .legal-alert {
    background: rgba(56,189,248,.12);
  }
}
</style>`

const defaultUserAgreementZh = legalDocumentStyle + `<article class="legal-doc" data-legal-document lang="zh-CN">
<header class="legal-hero">
  <p class="legal-kicker">Terms of Service</p>
  <h1>青鸟AI团队用户协议</h1>
  <p class="legal-meta"><strong>最后更新：</strong>2026 年 6 月 10 日</p>
  <div class="legal-alert"><strong>重要提示：</strong>请在注册、访问、充值或调用 API 前仔细阅读本协议。<strong>本平台仅向中国大陆地区以外的用户提供服务；如您位于中国大陆地区，或所在地法律禁止或限制使用本服务，请勿访问或使用本平台。</strong></div>
</header>

<nav class="legal-toc" aria-label="目录">
  <h2>大纲</h2>
  <ol>
    <li><a href="#agreement-service">服务概述</a></li>
    <li><a href="#agreement-eligibility">使用资格与适用地区</a></li>
    <li><a href="#agreement-account">账户与安全</a></li>
    <li><a href="#agreement-payment">付款、额度与退款</a></li>
    <li><a href="#agreement-content">用户内容与模型输出</a></li>
    <li><a href="#agreement-prohibited">禁止行为</a></li>
    <li><a href="#agreement-suspension">服务暂停与终止</a></li>
    <li><a href="#agreement-privacy">隐私与数据处理</a></li>
    <li><a href="#agreement-rights">知识产权与反馈</a></li>
    <li><a href="#agreement-liability">免责声明与责任限制</a></li>
    <li><a href="#agreement-law">适用法律与争议</a></li>
    <li><a href="#agreement-contact">联系信息</a></li>
  </ol>
</nav>

<section class="legal-section" id="agreement-service">
  <h2>1. 服务概述</h2>
  <p>青鸟AI团队运营一个面向开发者和企业用户的 AI API 聚合与分发平台。用户可通过本平台访问第三方应用程序编程接口（“API”），调用平台列示或配置的各类生成式 AI 模型、嵌入模型、图像模型、音频模型及其他相关能力（统称“AI 模型”）。</p>
  <p>本平台可能提供统一鉴权、API Key 管理、模型路由、额度管理、用量统计、日志查询、账单计费、渠道监控、接口文档和其他辅助功能。<strong>青鸟AI团队可根据业务、合规、技术或上游服务变化，随时新增、调整或移除模型、渠道、价格、限额和功能。</strong></p>
</section>

<section class="legal-section" id="agreement-eligibility">
  <h2>2. 使用资格与适用地区</h2>
  <h3>2.1 年龄与行为能力</h3>
  <p><strong>您必须年满 18 周岁，且具备签署和履行本协议所需的完全民事行为能力。</strong>如您代表公司、机构或其他组织使用本平台，您声明并保证您已获得充分授权，可代表该实体接受本协议。</p>
  <h3>2.2 地区限制</h3>
  <p><strong>本平台不向中国大陆地区用户提供服务。</strong>您声明并保证：您不位于中国大陆地区，不以中国大陆地区身份信息注册或使用本平台，也不会通过代理、VPN、共享账号或其他技术手段规避地域限制。</p>
  <p>如果您所在司法辖区的法律法规禁止或限制访问、购买、使用 AI API、生成式 AI 服务或相关支付服务，您应自行遵守当地法律，并立即停止使用本平台。</p>
</section>

<section class="legal-section" id="agreement-account">
  <h2>3. 账户与安全</h2>
  <p>您注册账户时应提供真实、准确、完整并保持更新的信息。您应妥善保管账户、密码、API Key、访问令牌、OAuth 凭证及其他认证信息。<strong>通过您的账户或 API Key 发起的全部请求、充值、消费、配置变更和其他行为，均视为您本人或您授权的行为。</strong></p>
  <p>如您发现账户或凭证可能泄露、被盗用或存在异常调用，应立即停止相关 Key 并通过平台公示的联系方式通知青鸟AI团队。因您保管不善、共享凭证或运行环境泄露导致的损失，由您自行承担。</p>
</section>

<section class="legal-section" id="agreement-payment">
  <h2>4. 付款、额度与退款</h2>
  <h3>4.1 预付额度与计费</h3>
  <p>本平台可能采用预付费额度、按量计费、套餐、分组倍率、模型单价或其他计费方式。具体价格、倍率、额度消耗、免费额度、有效期、最低充值金额和结算规则以平台页面、订单页面或后台设置展示为准。</p>
  <h3>4.2 Stripe 支付</h3>
  <p><strong>本平台在线付款主要通过第三方支付服务商 Stripe 处理。</strong>您授权 Stripe 及其合作机构按照订单金额、币种、税费、风控和结算规则处理付款。您在支付页面提交的银行卡号、账单地址、支付认证信息等由 Stripe 按其条款和隐私政策处理；青鸟AI团队通常不会保存完整银行卡信息。</p>
  <h3>4.3 退款</h3>
  <p>除非适用法律另有强制规定或平台另有明确说明，<strong>已完成的充值、已购买套餐和已消耗额度通常不支持退款。</strong>如因青鸟AI团队原因导致重大服务故障且您无法使用对应额度，青鸟AI团队可根据实际情况评估补偿或退款。</p>
</section>

<section class="legal-section" id="agreement-content">
  <h2>5. 用户内容与模型输出</h2>
  <p>您可向本平台提交文本、图片、文件、音频、代码、业务数据、提示词和其他内容（“输入”），并从 AI 模型获得回复、图片、嵌入向量、代码或其他结果（“输出”）。您保留对输入依法享有的权利，但应确保您拥有提交、处理和转发输入所需的全部授权。</p>
  <p><strong>AI 模型输出可能不准确、不完整、过时、存在偏见或不适合您的场景。</strong>您应自行评估输出结果，不得将输出作为医疗、法律、金融、投资、安全、身份核验或其他高风险事项的唯一依据。</p>
  <p>部分上游模型服务商可能根据其条款记录、保留、审查或用于改进模型的目的处理输入和输出。青鸟AI团队会尽合理努力展示和选择合适渠道，但<strong>不控制也不保证第三方模型服务商的数据处理方式。</strong></p>
</section>

<section class="legal-section" id="agreement-prohibited">
  <h2>6. 禁止行为</h2>
  <p>您不得利用本平台从事任何违法、侵权、欺诈、滥用、攻击、绕过限制或违反第三方模型政策的行为，包括但不限于：</p>
  <ul>
    <li>生成、传播或协助传播违法、有害、侵权、恶意代码、钓鱼、诈骗、骚扰、仇恨或暴力内容；</li>
    <li>未经授权访问、抓取、复制、转售、出租、共享或批量滥用平台、模型、账户、Key 或额度；</li>
    <li>绕过限流、风控、地域限制、计费系统、内容安全策略或上游服务商的使用限制；</li>
    <li>侵犯第三方知识产权、商业秘密、隐私权、肖像权、公开权或其他合法权益；</li>
    <li>干扰平台服务器、网络、数据库、支付、日志、监控或其他系统的正常运行。</li>
  </ul>
</section>

<section class="legal-section" id="agreement-suspension">
  <h2>7. 服务暂停与终止</h2>
  <p>如您违反本协议、平台规则、适用法律法规或第三方服务商政策，或存在异常调用、恶意注册、支付风险、攻击行为、滥用资源等情形，青鸟AI团队有权限制、暂停或终止您的账户、API Key、额度、访问权限或相关服务。</p>
  <p>青鸟AI团队也可因系统维护、安全风险、上游服务调整、合规要求、业务变化或不可抗力，临时或永久调整、暂停或终止部分或全部服务。对于服务变更，青鸟AI团队会尽合理努力通过站内公告、页面提示或其他适当方式通知。</p>
</section>

<section class="legal-section" id="agreement-privacy">
  <h2>8. 隐私与数据处理</h2>
  <p>请阅读《隐私政策》了解青鸟AI团队如何收集、使用、保存、共享和保护您的个人信息、调用数据、支付信息和日志信息。隐私政策构成本协议的一部分。</p>
  <p>为提供服务、计量费用、防止滥用和排查故障，本平台可能记录账户信息、调用时间、模型名称、渠道、状态码、Token 用量、额度消耗、IP 地址、User-Agent、错误信息及必要系统日志。</p>
</section>

<section class="legal-section" id="agreement-rights">
  <h2>9. 知识产权与反馈</h2>
  <p>本平台的界面、标识、文档、代码、系统设计、数据编排、计费配置、模型路由逻辑及其他服务元素，受知识产权和其他法律保护。未经授权，您不得复制、修改、反向工程、出租、转售或创建竞争性服务。</p>
  <p>如您向青鸟AI团队提交建议、反馈、错误报告或改进意见，您同意青鸟AI团队可为改进服务、开发功能或运营业务目的使用该等反馈，且无需另行向您支付费用。</p>
</section>

<section class="legal-section" id="agreement-liability">
  <h2>10. 免责声明与责任限制</h2>
  <p><strong>本平台按“现状”和“可用”状态提供。</strong>青鸟AI团队不保证服务不间断、无错误、完全安全、满足您的特定目的，或任何 AI 模型输出准确、完整、合法、可靠或适用于您的业务。</p>
  <p>在法律允许的最大范围内，青鸟AI团队不对间接、附带、特殊、惩罚性或后果性损害承担责任，包括利润损失、数据丢失、业务中断、商誉损害、第三方索赔、上游服务异常或您依赖模型输出产生的损失。</p>
</section>

<section class="legal-section" id="agreement-law">
  <h2>11. 适用法律与争议</h2>
  <p><strong>本协议的订立、效力、解释、履行和争议解决，适用香港法律</strong>，但不适用其法律冲突规则。因本协议或服务使用引起或相关的争议，双方应先友好协商；协商不成的，提交香港有管辖权的法院解决，除非适用法律另有强制规定。</p>
</section>

<section class="legal-section" id="agreement-contact">
  <h2>12. 联系信息</h2>
  <p>如您对本协议、账户、付款、模型调用或合规事项有疑问，请通过平台公示的客服、工单、邮箱或其他联系方式联系青鸟AI团队。</p>
</section>
</article>`

const defaultPrivacyPolicyZh = legalDocumentStyle + `<article class="legal-doc" data-legal-document lang="zh-CN">
<header class="legal-hero">
  <p class="legal-kicker">Privacy Policy</p>
  <h1>青鸟AI团队隐私政策</h1>
  <p class="legal-meta"><strong>最后更新：</strong>2026 年 6 月 10 日</p>
  <div class="legal-alert"><strong>重要提示：</strong>本隐私政策说明青鸟AI团队如何处理您的账户信息、API 调用数据、支付信息和日志信息。<strong>本平台不向中国大陆地区用户提供服务；如您不符合适用地区要求，请勿访问、注册或使用本平台。</strong></div>
</header>

<nav class="legal-toc" aria-label="目录">
  <h2>大纲</h2>
  <ol>
    <li><a href="#privacy-collection">我们收集的信息</a></li>
    <li><a href="#privacy-inputs">输入、输出与上游模型</a></li>
    <li><a href="#privacy-cookies">Cookies 与本地存储</a></li>
    <li><a href="#privacy-use">我们如何使用信息</a></li>
    <li><a href="#privacy-sharing">共享与披露</a></li>
    <li><a href="#privacy-payment">Stripe 支付信息</a></li>
    <li><a href="#privacy-rights">您的权利与选择</a></li>
    <li><a href="#privacy-security">数据安全</a></li>
    <li><a href="#privacy-retention">数据保留</a></li>
    <li><a href="#privacy-transfer">跨境传输与适用法律</a></li>
    <li><a href="#privacy-minors">未成年人</a></li>
    <li><a href="#privacy-contact">联系我们</a></li>
  </ol>
</nav>

<section class="legal-section" id="privacy-collection">
  <h2>1. 我们收集的信息</h2>
  <p>当您注册、登录、配置、充值或使用本平台时，我们可能收集账户标识、邮箱、用户名、登录凭证摘要、OAuth 授权信息、联系方式、账号角色、分组、额度、订单、发票状态、支付状态以及您主动提交的其他资料。</p>
  <p>当您调用 API 或使用平台功能时，我们可能收集 API Key 标识、请求时间、模型名称、渠道信息、调用路径、状态码、Token 用量、额度消耗、错误信息、IP 地址、User-Agent、设备和浏览器信息、系统日志以及用于风控、审计和故障排查的必要元数据。</p>
</section>

<section class="legal-section" id="privacy-inputs">
  <h2>2. 输入、输出与上游模型</h2>
  <p>您提交的提示词、文件、图片、音频、代码、业务数据及其他输入，可能会被本平台临时处理，并根据您选择的模型或平台路由发送至第三方模型服务商生成响应。</p>
  <p><strong>青鸟AI团队不控制第三方模型服务商如何处理您的输入、输出或日志，包括其是否保留数据、用于安全审查或用于模型改进。</strong>您应在使用特定模型前自行了解并确认对应服务商的条款、隐私政策和数据处理规则。</p>
</section>

<section class="legal-section" id="privacy-cookies">
  <h2>3. Cookies 与本地存储</h2>
  <p>为保持登录状态、保存语言偏好、主题设置、安全校验、基础统计和提升使用体验，本平台可能使用 Cookies、本地存储或类似技术。您可以通过浏览器设置管理或清除相关数据，但这可能影响登录、鉴权和部分功能的正常使用。</p>
</section>

<section class="legal-section" id="privacy-use">
  <h2>4. 我们如何使用信息</h2>
  <p><strong>我们仅会为提供、维护、计费、保护和改进本平台所需目的处理信息。</strong>具体用途包括账户创建与维护、API 转发、模型聚合、鉴权、额度计算、账单处理、调用记录展示、客服支持、故障排查、安全防护、反欺诈、反滥用、合规审计以及争议处理。</p>
  <p>我们不会将您的 API 请求内容用于与本平台服务无关的广告画像。除非获得您的明确授权、为提供服务所必需，或法律法规另有要求，我们不会主动出售您的个人信息。</p>
</section>

<section class="legal-section" id="privacy-sharing">
  <h2>5. 共享与披露</h2>
  <p>为完成您的请求、支付、通知、安全防护或故障排查，必要数据可能会被传输至第三方模型服务商、云基础设施、支付机构、邮件服务、风控服务、日志监控服务或其他代表我们处理数据的服务提供商。</p>
  <p>在以下情况下，我们也可能披露相关信息：遵守法律法规、司法程序、政府或监管要求；执行用户协议和平台规则；保护青鸟AI团队、用户、公众或第三方的权利、财产和安全；处理合并、重组、资产转让等业务变化；或取得您的同意。</p>
</section>

<section class="legal-section" id="privacy-payment">
  <h2>6. Stripe 支付信息</h2>
  <p><strong>本平台在线付款主要由 Stripe 处理。</strong>您在支付页面提交的银行卡号、账单地址、支付认证信息等支付数据由 Stripe 收集和处理。青鸟AI团队通常仅接收支付结果、订单编号、交易状态、金额、币种、时间和必要的风控或对账信息。</p>
</section>

<section class="legal-section" id="privacy-rights">
  <h2>7. 您的权利与选择</h2>
  <p>在适用法律允许的范围内，您可以请求访问、更正、删除您的个人信息，撤回部分授权，注销账号，或获取与隐私相关的说明。为保护账号安全，我们可能需要验证您的身份，并在合理期限内处理请求。</p>
  <p>部分信息因账务、审计、安全、争议处理、反滥用或法律义务需要，可能无法立即删除。删除账号或数据也可能导致额度、订单、API Key、调用记录和相关服务不可恢复。</p>
</section>

<section class="legal-section" id="privacy-security">
  <h2>8. 数据安全</h2>
  <p>我们采取合理的技术和管理措施保护数据安全，包括访问控制、权限隔离、日志审计、密钥管理、加密传输、安全配置和异常监控等。<strong>但互联网传输和电子存储无法保证绝对安全，任何传输均由您自行承担风险。</strong></p>
</section>

<section class="legal-section" id="privacy-retention">
  <h2>9. 数据保留</h2>
  <p>我们会在实现本政策所述目的所需的期限内保存信息，并根据业务、法律、审计、争议解决和安全防护需要保留必要记录。对于不再需要的信息，我们会在合理范围内删除、匿名化或停止主动使用。</p>
</section>

<section class="legal-section" id="privacy-transfer">
  <h2>10. 跨境传输与适用法律</h2>
  <p>由于本平台可能使用境外云服务、模型服务和支付服务，您的信息可能被传输至您所在地区以外的国家或地区处理。您使用本平台，即表示理解并同意此类必要传输。</p>
  <p><strong>本隐私政策及相关争议适用香港法律</strong>，但不适用其法律冲突规则，除非适用法律另有强制规定。</p>
</section>

<section class="legal-section" id="privacy-minors">
  <h2>11. 未成年人</h2>
  <p>本平台不面向未成年人提供服务。若您未满 18 周岁，或未达到所在地法律规定可独立订立合同的年龄，请不要注册或使用本平台。</p>
</section>

<section class="legal-section" id="privacy-contact">
  <h2>12. 联系我们</h2>
  <p>如您对本隐私政策、个人信息处理或数据安全有疑问、请求或投诉，请通过平台公示的客服、工单、邮箱或其他联系方式联系青鸟AI团队。</p>
</section>
</article>`

const defaultUserAgreementEn = legalDocumentStyle + `<article class="legal-doc" data-legal-document lang="en">
<header class="legal-hero">
  <p class="legal-kicker">Terms of Service</p>
  <h1>Bluebird AI Team User Agreement</h1>
  <p class="legal-meta"><strong>Last updated:</strong> June 10, 2026</p>
  <div class="legal-alert"><strong>Important Notice:</strong> Please read this Agreement carefully before registering, accessing, topping up, or calling the API. <strong>The Services are provided only to users outside Mainland China. If you are located in Mainland China, or if your local laws prohibit or restrict use of the Services, do not access or use the Platform.</strong></div>
</header>

<nav class="legal-toc" aria-label="Table of contents">
  <h2>Outline</h2>
  <ol>
    <li><a href="#agreement-service-en">Service Overview</a></li>
    <li><a href="#agreement-eligibility-en">Eligibility and Regions</a></li>
    <li><a href="#agreement-account-en">Accounts and Security</a></li>
    <li><a href="#agreement-payment-en">Payment, Credits and Refunds</a></li>
    <li><a href="#agreement-content-en">User Content and Outputs</a></li>
    <li><a href="#agreement-prohibited-en">Prohibited Conduct</a></li>
    <li><a href="#agreement-suspension-en">Suspension and Termination</a></li>
    <li><a href="#agreement-privacy-en">Privacy and Data Processing</a></li>
    <li><a href="#agreement-rights-en">Intellectual Property and Feedback</a></li>
    <li><a href="#agreement-liability-en">Disclaimers and Liability</a></li>
    <li><a href="#agreement-law-en">Governing Law and Disputes</a></li>
    <li><a href="#agreement-contact-en">Contact</a></li>
  </ol>
</nav>

<section class="legal-section" id="agreement-service-en">
  <h2>1. Service Overview</h2>
  <p>The Bluebird AI Team operates an AI API aggregation and distribution platform for developers and enterprise users. Through the Platform, users may access third-party APIs to call generative AI models, embedding models, image models, audio models, and other related capabilities listed or configured on the Platform.</p>
  <p>The Platform may provide unified authentication, API key management, model routing, credit management, usage statistics, log review, billing, channel monitoring, API documentation, and related tools. <strong>The Bluebird AI Team may add, adjust, or remove models, channels, pricing, limits, and features at any time due to business, compliance, technical, or upstream service changes.</strong></p>
</section>

<section class="legal-section" id="agreement-eligibility-en">
  <h2>2. Eligibility and Permissible Regions</h2>
  <h3>2.1 Age and Capacity</h3>
  <p><strong>You must be at least 18 years old and have full legal capacity to enter into and perform this Agreement.</strong> If you use the Platform on behalf of a company or organization, you represent that you are duly authorized to bind that entity.</p>
  <h3>2.2 Regional Restrictions</h3>
  <p><strong>The Platform is not provided to users in Mainland China.</strong> You represent that you are not located in Mainland China, will not register or use the Platform with Mainland China identity information, and will not use proxies, VPNs, shared accounts, or other technical means to circumvent regional restrictions.</p>
</section>

<section class="legal-section" id="agreement-account-en">
  <h2>3. Accounts and Security</h2>
  <p>You must provide true, accurate, complete, and current registration information. You are responsible for keeping your account, password, API keys, access tokens, OAuth credentials, and other authentication materials secure. <strong>All requests, top-ups, spending, configuration changes, and other actions made through your account or API keys are deemed to be made by you or with your authorization.</strong></p>
</section>

<section class="legal-section" id="agreement-payment-en">
  <h2>4. Payment, Credits, and Refunds</h2>
  <h3>4.1 Credits and Billing</h3>
  <p>The Platform may use prepaid credits, pay-as-you-go billing, packages, group ratios, model prices, or other billing methods. Specific prices, ratios, credit consumption, free credits, validity periods, minimum top-up amounts, and settlement rules are subject to the Platform pages, order pages, or system settings.</p>
  <h3>4.2 Stripe Payment</h3>
  <p><strong>Online payments on the Platform are primarily processed by Stripe.</strong> You authorize Stripe and its partners to process payments according to the order amount, currency, taxes, risk controls, and settlement rules. Card numbers, billing addresses, and payment authentication information submitted on the payment page are processed by Stripe under its own terms and privacy policy; the Bluebird AI Team generally does not store complete card information.</p>
  <h3>4.3 Refunds</h3>
  <p>Unless mandatory law requires otherwise or the Platform expressly states otherwise, <strong>completed top-ups, purchased packages, and consumed credits are generally non-refundable.</strong></p>
</section>

<section class="legal-section" id="agreement-content-en">
  <h2>5. User Content and Model Outputs</h2>
  <p>You may submit text, images, files, audio, code, business data, prompts, and other content to the Platform (“Inputs”) and receive responses, images, embeddings, code, or other results from AI models (“Outputs”). You retain the rights you lawfully hold in your Inputs and must ensure that you have all permissions needed to submit, process, and route them.</p>
  <p><strong>AI model Outputs may be inaccurate, incomplete, outdated, biased, or unsuitable for your use case.</strong> You must independently evaluate Outputs and must not rely on them as the sole basis for medical, legal, financial, investment, safety, identity verification, or other high-risk decisions.</p>
</section>

<section class="legal-section" id="agreement-prohibited-en">
  <h2>6. Prohibited Conduct</h2>
  <p>You may not use the Platform for illegal, infringing, fraudulent, abusive, attacking, restriction-circumventing, or upstream-policy-violating conduct, including generating harmful content, reselling unauthorized access, bypassing rate limits or billing, infringing third-party rights, or interfering with platform systems.</p>
</section>

<section class="legal-section" id="agreement-suspension-en">
  <h2>7. Suspension and Termination</h2>
  <p>If you violate this Agreement, Platform rules, applicable laws, or third-party provider policies, or if there is abnormal usage, malicious registration, payment risk, attack behavior, or resource abuse, the Bluebird AI Team may restrict, suspend, or terminate your account, API keys, credits, access, or related services.</p>
</section>

<section class="legal-section" id="agreement-privacy-en">
  <h2>8. Privacy and Data Processing</h2>
  <p>Please read the Privacy Policy to understand how the Bluebird AI Team collects, uses, stores, shares, and protects your personal information, API usage data, payment information, and logs. The Privacy Policy forms part of this Agreement.</p>
</section>

<section class="legal-section" id="agreement-rights-en">
  <h2>9. Intellectual Property and Feedback</h2>
  <p>The Platform interface, marks, documentation, code, system design, data orchestration, billing configuration, model routing logic, and other service elements are protected by intellectual property and other laws. You may not copy, modify, reverse engineer, rent, resell, or create a competing service without authorization.</p>
</section>

<section class="legal-section" id="agreement-liability-en">
  <h2>10. Disclaimers and Limitation of Liability</h2>
  <p><strong>The Platform is provided on an “as is” and “as available” basis.</strong> The Bluebird AI Team does not guarantee that the Services will be uninterrupted, error-free, fully secure, fit for your particular purpose, or that any AI model Output will be accurate, complete, lawful, reliable, or suitable for your business.</p>
</section>

<section class="legal-section" id="agreement-law-en">
  <h2>11. Governing Law and Disputes</h2>
  <p><strong>This Agreement is governed by the laws of Hong Kong</strong>, without regard to conflict-of-law rules. Disputes arising from this Agreement or use of the Services should first be resolved through good-faith negotiation; failing that, they shall be submitted to the competent courts of Hong Kong unless mandatory law requires otherwise.</p>
</section>

<section class="legal-section" id="agreement-contact-en">
  <h2>12. Contact</h2>
  <p>If you have questions about this Agreement, accounts, payments, model calls, or compliance matters, contact the Bluebird AI Team through the customer service, ticket, email, or other contact methods published on the Platform.</p>
</section>
</article>`

const defaultPrivacyPolicyEn = legalDocumentStyle + `<article class="legal-doc" data-legal-document lang="en">
<header class="legal-hero">
  <p class="legal-kicker">Privacy Policy</p>
  <h1>Bluebird AI Team Privacy Policy</h1>
  <p class="legal-meta"><strong>Last updated:</strong> June 10, 2026</p>
  <div class="legal-alert"><strong>Important Notice:</strong> This Privacy Policy explains how the Bluebird AI Team processes account information, API usage data, payment information, and logs. <strong>The Platform is not provided to users in Mainland China; if you do not meet the regional eligibility requirements, do not access, register for, or use the Platform.</strong></div>
</header>

<nav class="legal-toc" aria-label="Table of contents">
  <h2>Outline</h2>
  <ol>
    <li><a href="#privacy-collection-en">Information We Collect</a></li>
    <li><a href="#privacy-inputs-en">Inputs, Outputs and Upstream Models</a></li>
    <li><a href="#privacy-cookies-en">Cookies and Local Storage</a></li>
    <li><a href="#privacy-use-en">How We Use Information</a></li>
    <li><a href="#privacy-sharing-en">Sharing and Disclosure</a></li>
    <li><a href="#privacy-payment-en">Stripe Payment Information</a></li>
    <li><a href="#privacy-rights-en">Your Rights and Choices</a></li>
    <li><a href="#privacy-security-en">Data Security</a></li>
    <li><a href="#privacy-retention-en">Data Retention</a></li>
    <li><a href="#privacy-transfer-en">Transfers and Governing Law</a></li>
    <li><a href="#privacy-minors-en">Minors</a></li>
    <li><a href="#privacy-contact-en">Contact</a></li>
  </ol>
</nav>

<section class="legal-section" id="privacy-collection-en">
  <h2>1. Information We Collect</h2>
  <p>When you register, log in, configure, top up, or use the Platform, we may collect account identifiers, email addresses, usernames, credential digests, OAuth authorization information, contact information, account roles, groups, credits, orders, invoice status, payment status, and other information you submit.</p>
  <p>When you call APIs or use Platform features, we may collect API key identifiers, request times, model names, channel information, paths, status codes, token usage, credit consumption, errors, IP addresses, User-Agent, device and browser information, system logs, and necessary metadata for risk control, audit, and troubleshooting.</p>
</section>

<section class="legal-section" id="privacy-inputs-en">
  <h2>2. Inputs, Outputs, and Upstream Models</h2>
  <p>Prompts, files, images, audio, code, business data, and other Inputs you submit may be temporarily processed by the Platform and routed to third-party model providers to generate responses.</p>
  <p><strong>The Bluebird AI Team does not control how third-party model providers process your Inputs, Outputs, or logs, including whether they retain data, conduct safety review, or use data for model improvement.</strong> You should review the applicable provider terms, privacy policies, and data processing rules before using a specific model.</p>
</section>

<section class="legal-section" id="privacy-cookies-en">
  <h2>3. Cookies and Local Storage</h2>
  <p>The Platform may use cookies, local storage, or similar technologies to maintain login state, remember language preferences, save theme settings, perform security checks, collect basic statistics, and improve user experience. Browser restrictions may affect login, authentication, or other features.</p>
</section>

<section class="legal-section" id="privacy-use-en">
  <h2>4. How We Use Information</h2>
  <p><strong>We process information only for purposes necessary to provide, maintain, bill, protect, and improve the Platform.</strong> These purposes include account maintenance, API relay, model aggregation, authentication, credit calculation, billing, usage records, support, troubleshooting, security, anti-fraud, anti-abuse, compliance audit, and dispute handling.</p>
</section>

<section class="legal-section" id="privacy-sharing-en">
  <h2>5. Sharing and Disclosure</h2>
  <p>To complete your requests, payments, notifications, security protection, or troubleshooting, necessary data may be transferred to third-party model providers, cloud infrastructure, payment processors, email services, risk-control services, log monitoring services, or other service providers processing data on our behalf.</p>
</section>

<section class="legal-section" id="privacy-payment-en">
  <h2>6. Stripe Payment Information</h2>
  <p><strong>Online payments on the Platform are primarily processed by Stripe.</strong> Card numbers, billing addresses, and payment authentication information submitted on the payment page are collected and processed by Stripe. The Bluebird AI Team generally receives only payment results, order numbers, transaction status, amount, currency, time, and necessary risk-control or reconciliation information.</p>
</section>

<section class="legal-section" id="privacy-rights-en">
  <h2>7. Your Rights and Choices</h2>
  <p>Subject to applicable law, you may request access, correction, deletion, partial withdrawal of authorization, account closure, or privacy-related explanations. We may need to verify your identity and will process requests within a reasonable period.</p>
</section>

<section class="legal-section" id="privacy-security-en">
  <h2>8. Data Security</h2>
  <p>We use reasonable technical and organizational measures, including access control, permission isolation, log audit, key management, encrypted transmission, secure configuration, and anomaly monitoring. <strong>However, internet transmission and electronic storage cannot be guaranteed to be absolutely secure, and any transmission is at your own risk.</strong></p>
</section>

<section class="legal-section" id="privacy-retention-en">
  <h2>9. Data Retention</h2>
  <p>We retain information for as long as necessary for the purposes described in this Policy and as needed for business, legal, audit, dispute resolution, and security requirements. When information is no longer needed, we will delete, anonymize, or stop actively using it within a reasonable scope.</p>
</section>

<section class="legal-section" id="privacy-transfer-en">
  <h2>10. Transfers and Governing Law</h2>
  <p>Because the Platform may use overseas cloud, model, and payment services, your information may be transferred to countries or regions outside your location for processing. By using the Platform, you understand and agree to such necessary transfers.</p>
  <p><strong>This Privacy Policy and related disputes are governed by the laws of Hong Kong</strong>, without regard to conflict-of-law rules, unless mandatory law requires otherwise.</p>
</section>

<section class="legal-section" id="privacy-minors-en">
  <h2>11. Minors</h2>
  <p>The Platform is not intended for minors. If you are under 18 or have not reached the legal age to enter into a binding contract in your jurisdiction, do not register for or use the Platform.</p>
</section>

<section class="legal-section" id="privacy-contact-en">
  <h2>12. Contact Us</h2>
  <p>If you have questions, requests, or complaints about this Privacy Policy, personal information processing, or data security, contact the Bluebird AI Team through the customer service, ticket, email, or other contact methods published on the Platform.</p>
</section>
</article>`
