import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Blocks,
  CalendarCheck,
  CheckCircle2,
  FileCode2,
  Image as ImageIcon,
  Mic,
  Sparkles,
  Table2,
} from "lucide-react";
import { plugins } from "@/lib/plugins";

const featuredActions = [
  {
    icon: ImageIcon,
    title: "Docs 图片标注",
    description: "选中图片、添加批注，并生成干净的 AI 修订版本。",
    href: "/image-markup",
  },
  {
    icon: CalendarCheck,
    title: "会议纪要助手",
    description: "把日历上下文转成结构化 Docs 议程、纪要和行动项。",
    href: "/plugins/meeting-notes",
  },
  {
    icon: Table2,
    title: "表格清理工具",
    description: "为 Sheets 用户提供一键清理、规范化和导出准备。",
    href: "/plugins/sheet-cleanup",
  },
] as const;

const workflowSteps = [
  {
    title: "选择插件模板",
    description: "从插件目录进入对应详情页，确认适配的 Workspace 主应用和使用场景。",
  },
  {
    title: "复制 Apps Script",
    description: "每个插件目录都保留 manifest、脚本文件和部署说明，方便直接推送到 Apps Script。",
  },
  {
    title: "上线你的入口页",
    description: "在 Next.js 中维护官网介绍、插件索引和外部编辑器页面，让演示与发布保持一致。",
  },
];

const faqs = [
  {
    question: "这个网站主要展示什么？",
    answer: "它是 Google Workspace 插件实验室的官网和文档入口，用来集中展示插件、说明安装方式，并保留每个插件的 Apps Script 模板。",
  },
  {
    question: "新增插件要改很多页面吗？",
    answer: "通常只需要新增插件目录，并在 lib/plugins.ts 维护元数据，首页目录和详情页会复用同一份数据。",
  },
  {
    question: "可以作为正式发布页使用吗？",
    answer: "可以。当前布局按产品官网方式组织，有首屏价值主张、核心入口、功能说明、使用步骤和常见问题。",
  },
  {
    question: "代码和介绍内容会分离吗？",
    answer: "会。插件代码放在 plugins/*/appscript，网站内容和目录信息由 Next.js 页面与插件元数据驱动。",
  },
  {
    question: "是否只支持 Google Docs 插件？",
    answer: "不是。当前目录覆盖 Docs、Calendar、Drive、Sheets 等主应用，后续也可以继续扩展 Gmail 或 Slides。",
  },
  {
    question: "图片标注插件现在是什么状态？",
    answer: "Image Markup 是 prototype 状态，已经包含 Docs 图片扫描、外部画布标注、Drive 保存和 RunningHub 修订流程。",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Workspace Add-ons Lab">
          <span className="brand__mark">
            <Blocks size={19} aria-hidden="true" />
          </span>
          <span>Workspace Add-ons Lab</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#features">功能</a>
          <a href="#how-to-use">使用方式</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="button button--primary header-cta" href="#plugins">
          查看插件
        </Link>
      </header>

      <section className="hero hero--centered">
        <div className="hero__content">
          <p className="eyebrow">Google Workspace Add-ons</p>
          <h1>
            一个清晰的插件官网，
            <span>从介绍页到 Apps Script 模板都放好。</span>
          </h1>
          <p className="hero__copy">
            参考 AI transcription 官网的产品页节奏，重排为居中首屏、三入口卡片、交错功能介绍、三步使用指南与 FAQ，
            让插件目录更像可发布的 Workspace 产品主页。
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="#plugins">
              <Sparkles size={18} />
              浏览插件目录
            </Link>
            <a className="button" href="https://developers.google.com/workspace/add-ons" target="_blank">
              <ArrowUpRight size={18} />
              Google Add-ons 文档
            </a>
          </div>
        </div>

        <div className="action-grid" aria-label="Featured plugin actions">
          {featuredActions.map((action) => (
            <Link className="action-card" href={action.href} key={action.title}>
              <span className="action-card__icon">
                <action.icon size={25} aria-hidden="true" />
              </span>
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" id="features" aria-label="Workspace add-on features">
        <div className="section__header section__header--center">
          <p className="eyebrow">Why Choose This Lab?</p>
          <h2>把插件想法做成完整产品入口</h2>
          <p>
            首页不再只是目录，而是用产品介绍页的方式解释价值、展示入口，并把插件开发流程从代码目录延伸到用户可理解的网页。
          </p>
        </div>

        <div className="feature-showcase">
          <article className="feature-row">
            <div className="feature-copy">
              <span className="feature-kicker">01 / Catalog</span>
              <h3>插件卡片即产品入口</h3>
              <p>
                三个核心插件被放在首屏下方，用户可以像参考站选择“上传文件、实时转写、录音转写”一样，直接选择自己的 Workspace 工作流。
              </p>
            </div>
            <div className="product-preview product-preview--blue">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-card">
                <Mic size={30} />
                <strong>Workspace workflow</strong>
                <p>Docs, Calendar, Drive and Sheets add-ons are grouped by use case.</p>
              </div>
            </div>
          </article>

          <article className="feature-row feature-row--reverse">
            <div className="feature-copy">
              <span className="feature-kicker">02 / Templates</span>
              <h3>Apps Script 模板保持可复制</h3>
              <p>
                每个插件仍然保留独立目录、manifest、Code.gs 与 README。网站负责解释，目录负责交付代码，二者互不打架。
              </p>
            </div>
            <div className="product-preview product-preview--green">
              <div className="code-stack">
                <span>plugins / image-markup</span>
                <span>appscript / Code.js</span>
                <span>appscript / appsscript.json</span>
                <span>README.md</span>
              </div>
            </div>
          </article>

          <article className="feature-row">
            <div className="feature-copy">
              <span className="feature-kicker">03 / Publishing</span>
              <h3>官网结构适合继续扩展</h3>
              <p>
                功能区、使用方式和 FAQ 都按可增长的信息架构组织，后续可以自然加入安装按钮、 Marketplace 链接、截图与视频。
              </p>
            </div>
            <div className="product-preview product-preview--amber">
              <div className="metric-grid">
                <span>
                  <strong>{plugins.length}</strong>
                  plugins
                </span>
                <span>
                  <strong>6</strong>
                  hosts
                </span>
                <span>
                  <strong>1</strong>
                  prototype
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section section--soft" id="how-to-use">
        <div className="section__header">
          <p className="eyebrow">How To Use</p>
          <h2>三步进入插件开发流</h2>
        </div>
        <div className="step-grid">
          {workflowSteps.map((step, index) => (
            <article className="step-card" key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="plugins">
        <div className="section__header section__header--center">
          <p className="eyebrow">Plugin Catalog</p>
          <h2>当前插件</h2>
        </div>
        <div className="plugin-grid">
          {plugins.map((plugin) => (
            <Link className="plugin-card" href={`/plugins/${plugin.slug}`} key={plugin.slug}>
              <div className="plugin-card__top">
                {plugin.iconPath ? (
                  <Image className="plugin-icon" src={plugin.iconPath} alt="" width={64} height={64} aria-hidden="true" />
                ) : (
                  <span className="plugin-icon plugin-icon--placeholder">
                    <Blocks size={24} aria-hidden="true" />
                  </span>
                )}
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
              <span className="status">{plugin.status}</span>
              <h3>{plugin.name}</h3>
              <p>{plugin.tagline}</p>
              <div className="host-list">
                {plugin.hosts.map((host) => (
                  <span key={host}>{host}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section--soft" id="faq">
        <div className="section__header">
          <p className="eyebrow">FAQ</p>
          <h2>常见问题</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((item) => (
            <article className="faq-item" key={item.question}>
              <CheckCircle2 size={19} aria-hidden="true" />
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <Link className="brand" href="/" aria-label="Workspace Add-ons Lab">
          <span className="brand__mark">
            <FileCode2 size={19} aria-hidden="true" />
          </span>
          <span>Workspace Add-ons Lab</span>
        </Link>
        <p>Built for fast Google Workspace add-on prototyping.</p>
      </footer>
    </main>
  );
}
