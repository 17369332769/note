import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
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
    title: "Select a Docs Image",
    description: "Scan inline images from the Google Docs sidebar or upload a local image in the editor.",
  },
  {
    icon: Pencil,
    title: "Mark the Requested Edit",
    description: "Use freehand marks, arrows, boxes, and text notes to show exactly what should change.",
  },
  {
    icon: Wand2,
    title: "Create a Clean Revision",
    description: "Keep the annotated image for review and generate a clean revision for the document when needed.",
  },
] as const;

const imageMarkupFaqs = [
  {
    question: "How is Image Markup different from screenshot annotation?",
    answer: "It is built for Google Docs image workflows: create a session from the Docs sidebar, save annotated PNGs and edit briefs, and insert revised images back into the document.",
  },
  {
    question: "Which annotation tools are supported?",
    answer: "Image Markup supports selection, freehand drawing, arrows, box highlights, text notes, undo, redo, zoom, and PNG export.",
  },
  {
    question: "How are AI revisions generated?",
    answer: "When you request an AI revision, the editor sends the original image, annotated image, and structured edit brief to the backend and uses the configured image generation service to create a clean version.",
  },
  {
    question: "Can I use it without opening Google Docs?",
    answer: "Yes. You can open the editor directly, upload a PNG, JPEG, or WebP image, then annotate, download, or generate a revision.",
  },
  {
    question: "Are images stored permanently?",
    answer: "Images are used only for the annotation, export, and revision workflows you start. Temporary images are normally deleted or expired within 30 days. See the privacy policy for details.",
  },
  {
    question: "Who is Image Markup for?",
    answer: "It is for Docs users and content teams that need to explain image edits, generate clean revised images, and keep a clear review artifact.",
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

  if (plugin.slug === "figma-image-markup") {
    return {
      title: "Figma Image Markup | Addlet",
      description: "Export selected Figma layers into the Image Markup annotation editor.",
      icons: plugin.iconPath ? [{ url: plugin.iconPath }] : undefined,
    };
  }

  return {
    title: `${plugin.name} | Addlet`,
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
      title: "Understand the Workflow",
      description: plugin.audience,
    },
    {
      icon: FileCode2,
      title: "Review the Implementation",
      description: `Implementation files are stored in ${plugin.appScriptPath}.`,
    },
    {
      icon: Sparkles,
      title: "Continue Setup",
      description: "Use the README and setup steps to finish configuration before publishing to Workspace.",
    },
  ] as const;
}

function getDetailFaqs(plugin: NonNullable<ReturnType<typeof getPlugin>>) {
  if (plugin.slug === "image-markup") return imageMarkupFaqs;

  return [
    {
      question: `What is the current status of ${plugin.name}?`,
      answer: `Current status: ${plugin.status}.`,
    },
    {
      question: "Which Google Workspace hosts are supported?",
      answer: `Current hosts: ${plugin.hosts.join(", ")}.`,
    },
    {
      question: "Where is the Apps Script implementation?",
      answer: `The Apps Script directory is ${plugin.appScriptPath}.`,
    },
  ];
}

export function PluginProductPage({ plugin }: { plugin: NonNullable<ReturnType<typeof getPlugin>> }) {
  const detailActions = getDetailActions(plugin);
  const detailFaqs = getDetailFaqs(plugin);
  const isImageMarkup = plugin.slug === "image-markup";
  const implementationLabel = plugin.hosts.includes("Figma") ? "Figma Plugin" : "Apps Script";
  const productHref = (
    isImageMarkup ? "/image-markup" : plugin.hosts.includes("Figma") ? "/figma/image-markup" : `/plugins/${plugin.slug}`
  ) as Route;
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
          <a href="#features">Features</a>
          <a href={isImageMarkup ? "#how-it-works" : "#setup"}>{isImageMarkup ? "How It Works" : "Setup"}</a>
          <a href="#faq">FAQ</a>
        </nav>
        {isImageMarkup ? (
          <Link className="button button--primary header-cta" href={editorHref}>
            Open Editor
          </Link>
        ) : (
          <Link className="button button--primary header-cta" href="/">
            Back Home
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
              Open Annotation Editor
            </Link>
          ) : (
            <a className="button" href={`#${plugin.slug}-script`}>
              <FileCode2 size={18} />
              View Script Directory
            </a>
          )}
          <a className="button" href="#features">
            <ArrowUpRight size={18} />
            View Features
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
          <h2>{isImageMarkup ? "From visual markup to clean revision" : "From source image to clean revision"}</h2>
          <p>
            {isImageMarkup
              ? "Image Markup lets you draw visual feedback directly on an image, reduce back-and-forth, and keep both the annotated handoff and the clean final image in your document workflow."
              : plugin.audience}
          </p>
        </div>

        <div className="feature-showcase">
          <article className="feature-row">
            <div className="feature-copy">
              <h3>Select an image and start marking</h3>
              <p>
                Choose the image you want to edit from Google Docs, or upload a local image directly. The editor keeps every note anchored to the current image, so you do not need a separate instruction document.
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
              <h3>Use visual markup instead of long explanations</h3>
              <p>
                Circle an area with freehand marks, point to issues with arrows, frame important regions with boxes, and add short text notes. Reviewers can understand the requested change by looking at the image.
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
              <h3>Keep both the annotated handoff and the clean version</h3>
              <p>
                Download the annotated PNG as the review artifact, then generate a clean revision when you need the final image without visible markup.
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
          <h2>{isImageMarkup ? "Complete image review in three steps" : "Setup and development steps"}</h2>
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
                    ? "Open an Image"
                    : index === 1
                      ? "Mark the Edit"
                      : "Export or Generate"
                  : index === 0
                    ? "Configure Scripts"
                    : index === 1
                      ? "Connect Services"
                      : "Test the Add-on"}
              </h3>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      {isImageMarkup ? (
        <section className="section" id="outputs">
          <div className="section__header section__header--center">
            <h2>Make feedback clear and keep the final image clean</h2>
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
            <p className="eyebrow">{implementationLabel}</p>
            <h2>Plugin Directory and Feature Structure</h2>
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
          <h2>Frequently Asked Questions</h2>
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
