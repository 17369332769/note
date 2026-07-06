import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  FileCode2,
  Image as ImageIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { plugins } from "@/lib/plugins";

const featuredActions = [
  {
    icon: ImageIcon,
    title: "Select a Docs image",
    description: "Start from an inline Google Docs image or upload a local PNG, JPEG, or WebP.",
    href: "/image-markup",
  },
  {
    icon: FileCode2,
    title: "Mark the exact edit",
    description: "Use arrows, boxes, freehand notes, and text callouts to make image feedback clear.",
    href: "/plugins/image-markup",
  },
  {
    icon: Wand2,
    title: "Export clean outputs",
    description: "Download the annotated PNG or generate a clean AI revision for your document.",
    href: "/image-markup/editor",
  },
] as const;

const workflowSteps = [
  {
    title: "Open Image Markup",
    description: "Launch the editor from Google Docs or use the browser editor for a local image.",
  },
  {
    title: "Add visual feedback",
    description: "Draw directly on the image so reviewers can see exactly what should change.",
  },
  {
    title: "Return to your workflow",
    description: "Export the annotated image, generate a clean revision, and continue in Google Docs.",
  },
];

const faqs = [
  {
    question: "What is Addlet?",
    answer: "Addlet builds focused Google Workspace add-ons. The first product is Image Markup for visual review inside Google Docs workflows.",
  },
  {
    question: "What does Image Markup access?",
    answer: "It accesses the selected Docs image, uploaded images, temporary session tokens, and workflow outputs only when needed to provide the image editing flow.",
  },
  {
    question: "Is AI generation required?",
    answer: "No. You can use Image Markup for annotation and export without generating a clean AI revision.",
  },
  {
    question: "Where can I read the privacy terms?",
    answer: "The Image Markup privacy policy and terms are linked from the product page footer and explain data use, retention, and support contact details.",
  },
  {
    question: "Who is Image Markup for?",
    answer: "It is for Docs users and content teams that need to explain visual edits clearly and keep a clean final image for the document.",
  },
  {
    question: "How do I get support?",
    answer: "For support, privacy, or legal questions, contact a17369332769@gmail.com.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Addlet">
          <span className="brand__mark">
            <Blocks size={19} aria-hidden="true" />
          </span>
          <span>Addlet</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#how-to-use">How It Works</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="button button--primary header-cta" href="/plugins/image-markup">
          View Product
        </Link>
      </header>

      <section className="hero hero--centered">
        <div className="hero__content">
          <p className="eyebrow">Google Docs image review</p>
          <h1>
            Image feedback that stays clear,
            <span>from markup to clean revision.</span>
          </h1>
          <p className="hero__copy">
            Addlet Image Markup helps Google Docs users select an image, draw precise visual notes, export annotated PNGs,
            and generate clean revised images when they need a polished final asset.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="/plugins/image-markup">
              <Sparkles size={18} />
              Explore Image Markup
            </Link>
            <a className="button" href="https://developers.google.com/workspace/add-ons" target="_blank">
              <ArrowUpRight size={18} />
              Google Workspace add-ons
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
          <p className="eyebrow">Why Addlet</p>
          <h2>Designed for visual feedback in documents</h2>
          <p>
            Image Markup keeps image review close to the Google Docs workflow while giving reviewers a dedicated canvas for clear, visual instructions.
          </p>
        </div>

        <div className="feature-showcase">
          <article className="feature-row">
            <div className="feature-copy">
              <span className="feature-kicker">01 / Select</span>
              <h3>Start from the image being discussed</h3>
              <p>
                Select an inline image from Google Docs or upload a local file, then move directly into a focused editor without creating a separate feedback document.
              </p>
            </div>
            <div className="product-preview product-preview--blue">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-card">
                <ImageIcon size={30} />
                <strong>Docs image workflow</strong>
                <p>Select, mark up, export, and return to your document.</p>
              </div>
            </div>
          </article>

          <article className="feature-row feature-row--reverse">
            <div className="feature-copy">
              <span className="feature-kicker">02 / Annotate</span>
              <h3>Make visual instructions unambiguous</h3>
              <p>
                Arrows, boxes, freehand marks, and text notes let collaborators understand the requested edit by looking at the image instead of decoding long comments.
              </p>
            </div>
            <div className="product-preview product-preview--green">
              <div className="code-stack">
                <span>Freehand notes</span>
                <span>Arrow callouts</span>
                <span>Box highlights</span>
                <span>Text labels</span>
              </div>
            </div>
          </article>

          <article className="feature-row">
            <div className="feature-copy">
              <span className="feature-kicker">03 / Deliver</span>
              <h3>Keep both the review artifact and the final image</h3>
              <p>
                Export a marked-up PNG for handoff, or use the AI revision flow to create a clean image that can be used back in the document.
              </p>
            </div>
            <div className="product-preview product-preview--amber">
              <div className="metric-grid">
                <span>
                  <strong>Docs</strong>
                  host
                </span>
                <span>
                  <strong>PNG</strong>
                  export
                </span>
                <span>
                  <strong>AI</strong>
                  revision
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section section--soft" id="how-to-use">
        <div className="section__header">
          <p className="eyebrow">How To Use</p>
          <h2>Three steps from image to decision</h2>
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
          <p className="eyebrow">Product</p>
          <h2>Image Markup for Google Docs</h2>
        </div>
        <div className="plugin-grid">
          {plugins
            .filter((plugin) => plugin.slug === "image-markup")
            .map((plugin) => (
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
              <span className="status">Google Docs add-on</span>
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
          <h2>Frequently Asked Questions</h2>
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
        <Link className="brand" href="/" aria-label="Addlet">
          <span className="brand__mark">
            <FileCode2 size={19} aria-hidden="true" />
          </span>
          <span>Addlet</span>
        </Link>
        <p>Focused Google Workspace add-ons for clearer document workflows.</p>
      </footer>
    </main>
  );
}
