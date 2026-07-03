import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  FileCode2,
  Image as ImageIcon,
  Layers3,
  MousePointer2,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import { getPlugin, plugins } from "@/lib/plugins";
import { getPolicyHref, getPolicyLabel, policyKinds } from "@/lib/policies";

type Props = {
  params: Promise<{ slug: string }>;
};

const imageMarkupActions = [
  {
    icon: ImageIcon,
    title: "选择 Docs 图片",
    description: "从 Google Docs 侧边栏扫描内嵌图片，或在编辑器里上传本地图片。",
  },
  {
    icon: Pencil,
    title: "标出修改意见",
    description: "使用画笔、箭头、矩形和文字说明，把想改的位置说清楚。",
  },
  {
    icon: Wand2,
    title: "生成干净修订图",
    description: "保留标注版做沟通凭证，同时生成可插回文档的 clean revision。",
  },
] as const;

const imageMarkupFaqs = [
  {
    question: "Image Markup 和普通截图标注有什么不同？",
    answer: "它面向 Google Docs 图片工作流：可以从文档侧边栏创建会话，保存标注 PNG 和编辑说明，并把修订图插回文档。",
  },
  {
    question: "现在支持哪些标注工具？",
    answer: "当前支持选择、自由画笔、箭头、矩形高亮和文字备注，也支持撤销、重做、缩放和 PNG 下载。",
  },
  {
    question: "AI 修订图是怎么生成的？",
    answer: "编辑器会把原图、标注图和结构化 edit brief 一起提交给后端，再通过 RunningHub 流程生成干净版本。",
  },
  {
    question: "可以不从 Docs 打开吗？",
    answer: "可以。你可以直接打开编辑器上传 PNG、JPEG 或 WebP 图片，完成标注、下载和 AI 修订。",
  },
  {
    question: "图片会一直保存吗？",
    answer: "图片仅用于你发起的标注、导出和修订流程。具体保存时间与部署环境、存储配置和隐私政策一致。",
  },
  {
    question: "适合什么用户？",
    answer: "适合需要在文档里沟通图片修改意见、生成干净修订图，并保留编辑依据的 Docs 用户和内容团队。",
  },
];

export function generateStaticParams() {
  return plugins.map((plugin) => ({ slug: plugin.slug }));
}

export function generatePluginMetadata(plugin: NonNullable<ReturnType<typeof getPlugin>>) {
  if (plugin.slug === "image-markup") {
    return {
      title: "Image Markup | Mark up Docs images",
      description: "Mark up Google Docs images with visual notes and generate clean AI revisions.",
      icons: plugin.iconPath ? [{ url: plugin.iconPath }] : undefined,
    };
  }

  return {
    title: `${plugin.name} | Workspace Add-ons Lab`,
    description: plugin.summary,
    icons: plugin.iconPath ? [{ url: plugin.iconPath }] : undefined,
  };
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const plugin = getPlugin(slug);

  if (!plugin) {
    return {};
  }

  return generatePluginMetadata(plugin);
}

function getDetailActions(plugin: NonNullable<ReturnType<typeof getPlugin>>) {
  if (plugin.slug === "image-markup") return imageMarkupActions;

  return [
    {
      icon: Blocks,
      title: "理解场景",
      description: plugin.audience,
    },
    {
      icon: FileCode2,
      title: "复制脚本",
      description: `Apps Script 模板保存在 ${plugin.appScriptPath}。`,
    },
    {
      icon: Sparkles,
      title: "继续扩展",
      description: "按 README 和 setup 步骤补齐业务能力，再发布到 Workspace。",
    },
  ] as const;
}

function getDetailFaqs(plugin: NonNullable<ReturnType<typeof getPlugin>>) {
  if (plugin.slug === "image-markup") return imageMarkupFaqs;

  return [
    {
      question: `${plugin.name} 现在是什么状态？`,
      answer: `当前状态是 ${plugin.status}，适合从现有 Apps Script 模板继续开发。`,
    },
    {
      question: "支持哪些 Google Workspace 主应用？",
      answer: `当前覆盖 ${plugin.hosts.join("、")}。`,
    },
    {
      question: "脚本代码在哪里？",
      answer: `脚本目录是 ${plugin.appScriptPath}。`,
    },
  ];
}

export function PluginProductPage({ plugin }: { plugin: NonNullable<ReturnType<typeof getPlugin>> }) {
  const detailActions = getDetailActions(plugin);
  const detailFaqs = getDetailFaqs(plugin);
  const isImageMarkup = plugin.slug === "image-markup";
  const productHref = (isImageMarkup ? "/image-markup" : `/plugins/${plugin.slug}`) as
    | "/image-markup"
    | `/plugins/${string}`;
  const editorHref = "/image-markup/editor" as const;

  return (
    <main className={isImageMarkup ? "product-page product-page--image-markup" : undefined}>
      <header className="site-header">
        <Link className="brand" href={productHref} aria-label={plugin.name}>
          {plugin.iconPath ? (
            <Image className="brand__icon" src={plugin.iconPath} alt="" width={36} height={36} aria-hidden="true" priority />
          ) : (
            <span className="brand__mark">
              <Blocks size={19} aria-hidden="true" />
            </span>
          )}
          <span>{plugin.name}</span>
        </Link>
        <nav className="nav-links" aria-label={`${plugin.name} page navigation`}>
          <a href="#features">功能</a>
          <a href={isImageMarkup ? "#how-it-works" : "#setup"}>{isImageMarkup ? "使用方式" : "安装"}</a>
          <a href="#faq">FAQ</a>
        </nav>
        {isImageMarkup ? (
          <Link className="button button--primary header-cta" href={editorHref}>
            打开编辑器
          </Link>
        ) : (
          <Link className="button button--primary header-cta" href="/">
            返回首页
          </Link>
        )}
      </header>

      <section className="detail-hero detail-hero--product">
        {isImageMarkup ? null : plugin.iconPath ? (
          <Image className="detail-icon" src={plugin.iconPath} alt="" width={104} height={104} aria-hidden="true" priority />
        ) : (
          <span className="detail-icon detail-icon--placeholder">
            <Blocks size={34} aria-hidden="true" />
          </span>
        )}
        {isImageMarkup ? null : <p className="eyebrow">{plugin.hosts.join(" / ")}</p>}
        <h1>
          {isImageMarkup ? (
            <>
              Image Markup
              <span className="detail-title__tagline">Mark up Docs images and generate clean revisions.</span>
            </>
          ) : (
            <>
              {plugin.name}
              <span className="detail-title__tagline">{plugin.tagline}</span>
            </>
          )}
        </h1>
        <p className="hero__copy">
          {isImageMarkup
            ? "Use Image Markup to point out image edits with arrows, boxes, freehand notes, and text callouts, then export the annotated version or create a clean AI-revised image for your Google Doc."
            : plugin.summary}
        </p>
        <div className="hero__actions">
          {isImageMarkup ? (
            <Link className="button button--primary" href={editorHref}>
              <MousePointer2 size={18} />
              打开标注编辑器
            </Link>
          ) : (
            <a className="button" href={`#${plugin.slug}-script`}>
              <FileCode2 size={18} />
              查看脚本目录
            </a>
          )}
          <a className="button" href="#features">
            <ArrowUpRight size={18} />
            了解功能
          </a>
        </div>
        {isImageMarkup ? null : (
          <div className="host-list host-list--large host-list--center">
            {plugin.hosts.map((host) => (
              <span key={host}>{host}</span>
            ))}
            <span>{plugin.status}</span>
          </div>
        )}
      </section>

      <section className="section section--soft" id="workflow">
        <div className="action-grid" aria-label={`${plugin.name} workflow`}>
          {detailActions.map((action) => (
            <article className="action-card" key={action.title}>
              <span className="action-card__icon">
                <action.icon size={25} aria-hidden="true" />
              </span>
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="features" aria-label={`${plugin.name} features`}>
        <div className="section__header section__header--center">
          {isImageMarkup ? null : <p className="eyebrow">Product Flow</p>}
          <h2>{isImageMarkup ? "从图片标注到干净修订图" : "从文档图片到干净修订图"}</h2>
          <p>
            {isImageMarkup
              ? "Image Markup 帮你把视觉修改意见直接画在图片上，减少来回解释，并把标注稿和干净版本分别交付给文档工作流。"
              : plugin.audience}
          </p>
        </div>

        <div className="feature-showcase">
          <article className="feature-row">
            <div className="feature-copy">
              <h3>选择图片，马上进入标注</h3>
              <p>
                从 Google Docs 里选择要修改的图片，或者直接上传本地图片。进入编辑器后，所有标注都围绕当前图片展开，不需要额外整理说明文档。
              </p>
            </div>
            <div className="product-preview product-preview--blue">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
              </div>
              <div className="markup-preview-card">
                <div className="markup-preview-image">
                  <span />
                  <strong>Original image</strong>
                </div>
                <div className="markup-preview-note">Choose an image and start marking</div>
              </div>
            </div>
          </article>

          <article className="feature-row feature-row--reverse">
            <div className="feature-copy">
              <h3>用视觉标注替代冗长描述</h3>
              <p>
                用画笔圈出区域、用箭头指向问题、用矩形框住重点，再加上简短文字。对方看到图片就能理解哪里要改、怎么改。
              </p>
            </div>
            <div className="product-preview product-preview--green">
              <div className="annotation-preview">
                <span className="annotation-line annotation-line--one" />
                <span className="annotation-line annotation-line--two" />
                <span className="annotation-box" />
                <span className="annotation-label">Clarify this area</span>
              </div>
            </div>
          </article>

          <article className="feature-row">
            <div className="feature-copy">
              <h3>同时保留标注稿和干净版本</h3>
              <p>
                下载带标注的 PNG 作为沟通依据，也可以生成去掉标注后的 clean revision。修改说明清楚，最终图片也干净。
              </p>
            </div>
            <div className="product-preview product-preview--amber">
              <div className="revision-preview">
                <span>Annotated PNG</span>
                <ArrowUpRight size={26} aria-hidden="true" />
                <span>Clean revision</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section section--soft" id={isImageMarkup ? "how-it-works" : "setup"}>
        <div className="section__header">
          <h2>{isImageMarkup ? "三步完成图片修改沟通" : "部署和开发步骤"}</h2>
        </div>
        <div className="step-grid">
          {(isImageMarkup
            ? [
                "Open Image Markup from Google Docs or upload a PNG, JPEG, or WebP image directly.",
                "Draw arrows, boxes, freehand marks, and text notes to explain the exact edit you want.",
                "Download the annotated PNG or generate a clean AI revision for use in your document.",
              ]
            : plugin.setup.slice(0, 3)
          ).map((step, index) => (
            <article className="step-card" key={step}>
              <span>{index + 1}</span>
              <h3>
                {isImageMarkup
                  ? index === 0
                    ? "打开图片"
                    : index === 1
                      ? "画出修改点"
                      : "导出或生成"
                  : index === 0
                    ? "配置脚本"
                    : index === 1
                      ? "连接服务"
                      : "测试插件"}
              </h3>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      {isImageMarkup ? (
        <section className="section" id="outputs">
          <div className="section__header section__header--center">
            <h2>清楚表达修改，也保留最终图片</h2>
          </div>
          <div className="feature-grid">
            {[
              "Annotated PNG for review and handoff",
              "Clean AI revision without visible markup",
              "Edit brief that summarizes the requested visual changes",
              "Recent sessions for continuing work from Google Docs",
            ].map((feature) => (
              <div className="feature" key={feature}>
                <CheckCircle2 size={20} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="section" id={`${plugin.slug}-script`}>
          <div className="section__header section__header--center">
            <p className="eyebrow">Apps Script</p>
            <h2>脚本目录和功能骨架</h2>
          </div>
          <div className="script-layout">
            <div className="code-panel">
              <div>
                <FileCode2 size={18} />
                <code>{plugin.appScriptPath}</code>
              </div>
            </div>
            <div className="feature-grid feature-grid--compact">
              {plugin.features.map((feature) => (
                <div className="feature" key={feature}>
                  <CheckCircle2 size={20} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section--soft" id="faq">
        <div className="section__header">
          <h2>常见问题</h2>
        </div>
        <div className="faq-grid">
          {detailFaqs.map((item) => (
            <article className="faq-item" key={item.question}>
              <CheckCircle2 size={19} aria-hidden="true" />
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={isImageMarkup ? "footer footer--centered" : "footer"}>
        <Link className="brand" href={productHref} aria-label={plugin.name}>
          {plugin.iconPath ? (
            <Image className="brand__icon" src={plugin.iconPath} alt="" width={36} height={36} aria-hidden="true" />
          ) : (
            <span className="brand__mark">
              <Layers3 size={19} aria-hidden="true" />
            </span>
          )}
          <span>{plugin.name}</span>
        </Link>
        <nav className="footer-links" aria-label={`${plugin.name} legal links`}>
          {policyKinds.map((policy) => (
            <Link href={getPolicyHref(plugin.slug, policy)} key={policy}>
              {getPolicyLabel(policy)}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}

export default async function PluginPage({ params }: Props) {
  const { slug } = await params;
  const plugin = getPlugin(slug);

  if (!plugin) {
    notFound();
  }

  return <PluginProductPage plugin={plugin} />;
}
