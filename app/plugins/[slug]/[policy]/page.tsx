import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Blocks } from "lucide-react";
import { getPlugin, plugins } from "@/lib/plugins";
import { getPolicyDocument, getPolicyHref, getPolicyLabel, isPolicyKind, policyKinds } from "@/lib/policies";

type Props = {
  params: Promise<{ slug: string; policy: string }>;
};

export function generateStaticParams() {
  return plugins.flatMap((plugin) => policyKinds.map((policy) => ({ slug: plugin.slug, policy })));
}

export async function generateMetadata({ params }: Props) {
  const { slug, policy } = await params;
  const plugin = getPlugin(slug);

  if (!plugin || !isPolicyKind(policy)) {
    return {};
  }

  const document = getPolicyDocument(plugin, policy);

  return {
    title: `${document.title} | Workspace Add-ons Lab`,
    description: document.summary,
  };
}

export default async function PluginPolicyPage({ params }: Props) {
  const { slug, policy } = await params;
  const plugin = getPlugin(slug);

  if (!plugin || !isPolicyKind(policy)) {
    notFound();
  }

  const document = getPolicyDocument(plugin, policy);
  const siblingPolicies = policyKinds.filter((item) => item !== policy);

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Workspace Add-ons Lab">
          <span className="brand__mark">
            <Blocks size={19} aria-hidden="true" />
          </span>
          <span>Workspace Add-ons Lab</span>
        </Link>
        <nav className="nav-links" aria-label={`${plugin.name} policy navigation`}>
          <Link href={`/plugins/${plugin.slug}`}>插件介绍</Link>
          {siblingPolicies.map((item) => (
            <Link href={getPolicyHref(plugin.slug, item)} key={item}>
              {getPolicyLabel(item)}
            </Link>
          ))}
        </nav>
        <Link className="button button--primary header-cta" href={`/plugins/${plugin.slug}`}>
          返回插件页
        </Link>
      </header>

      <section className="policy-hero">
        <Link className="back-link" href={`/plugins/${plugin.slug}`}>
          <ArrowLeft size={18} />
          返回 {plugin.name}
        </Link>
        <p className="eyebrow">{document.eyebrow}</p>
        <h1>
          {plugin.name}
          <span className="detail-title__tagline">{getPolicyLabel(policy)}</span>
        </h1>
        <p className="hero__copy">{document.summary}</p>
        <p className="policy-date">Effective date: {document.effectiveDate}</p>
      </section>

      <section className="section policy-section">
        <div className="policy-layout">
          <aside className="policy-toc" aria-label="Policy sections">
            {document.sections.map((section) => (
              <a href={`#${section.title.toLowerCase().replaceAll(" ", "-")}`} key={section.title}>
                {section.title}
              </a>
            ))}
          </aside>
          <div className="policy-content">
            {document.sections.map((section) => (
              <article id={section.title.toLowerCase().replaceAll(" ", "-")} key={section.title}>
                <h2>{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <Link className="brand" href="/" aria-label="Workspace Add-ons Lab">
          <span className="brand__mark">
            <Blocks size={19} aria-hidden="true" />
          </span>
          <span>Workspace Add-ons Lab</span>
        </Link>
        <nav className="footer-links" aria-label={`${plugin.name} legal links`}>
          {policyKinds.map((item) => (
            <Link href={getPolicyHref(plugin.slug, item)} key={item}>
              {getPolicyLabel(item)}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}
