import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileCode2, Terminal } from "lucide-react";
import { getPlugin, plugins } from "@/lib/plugins";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return plugins.map((plugin) => ({ slug: plugin.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const plugin = getPlugin(slug);

  if (!plugin) {
    return {};
  }

  return {
    title: `${plugin.name} | Workspace Add-ons Lab`,
    description: plugin.summary,
  };
}

export default async function PluginPage({ params }: Props) {
  const { slug } = await params;
  const plugin = getPlugin(slug);

  if (!plugin) {
    notFound();
  }

  return (
    <main>
      <section className="detail-hero">
        <Link className="back-link" href="/">
          <ArrowLeft size={18} />
          返回插件列表
        </Link>
        <p className="eyebrow">{plugin.hosts.join(" / ")}</p>
        <h1>{plugin.name}</h1>
        <p className="hero__copy">{plugin.summary}</p>
        <div className="host-list host-list--large">
          {plugin.hosts.map((host) => (
            <span key={host}>{host}</span>
          ))}
        </div>
      </section>

      <section className="section section--split">
        <div>
          <p className="eyebrow">Audience</p>
          <h2>使用场景</h2>
        </div>
        <p className="body-large">{plugin.audience}</p>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="eyebrow">What is included</p>
          <h2>功能骨架</h2>
        </div>
        <div className="feature-grid">
          {plugin.features.map((feature) => (
            <div className="feature" key={feature}>
              <CheckCircle2 size={20} />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section section--split">
        <div>
          <p className="eyebrow">Apps Script</p>
          <h2>脚本目录</h2>
        </div>
        <div className="code-panel">
          <div>
            <FileCode2 size={18} />
            <code>{plugin.appScriptPath}</code>
          </div>
          <div>
            <Terminal size={18} />
            <code>cd {plugin.appScriptPath} && npx clasp push</code>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="eyebrow">Setup</p>
          <h2>开发步骤</h2>
        </div>
        <ol className="setup-list">
          {plugin.setup.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
