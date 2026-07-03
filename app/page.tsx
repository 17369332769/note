import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Blocks, Code2, FileCode2, Layers3 } from "lucide-react";
import { plugins } from "@/lib/plugins";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero__content">
          <p className="eyebrow">Google Workspace Add-ons</p>
          <h1>一个目录管理一组插件，从网页介绍到 Apps Script 模板都在这里。</h1>
          <p className="hero__copy">
            这个项目用 Next.js 和 React 做插件官网与文档入口，每个插件目录保留自己的 Apps Script
            代码、manifest 和说明，适合快速孵化 Gmail、Calendar、Docs、Sheets 等 Workspace 插件。
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="#plugins">
              <Blocks size={18} />
              查看插件
            </Link>
            <a className="button" href="https://developers.google.com/workspace/add-ons" target="_blank">
              <ArrowUpRight size={18} />
              Google 文档
            </a>
          </div>
        </div>
        <div className="hero__panel" aria-label="Project structure preview">
          <div className="tree-line tree-line--root">
            <Layers3 size={18} />
            workspace-addons-lab
          </div>
          <div className="tree-line">
            <Code2 size={18} />
            app / Next.js 介绍页
          </div>
          <div className="tree-line">
            <FileCode2 size={18} />
            plugins / 每个目录一个插件
          </div>
          <div className="tree-line">
            <FileCode2 size={18} />
            appscript / Code.gs + appsscript.json
          </div>
        </div>
      </section>

      <section className="section" id="plugins">
        <div className="section__header">
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

      <section className="section section--split">
        <div>
          <p className="eyebrow">Convention</p>
          <h2>扩展方式很简单</h2>
        </div>
        <div className="steps">
          <p>复制 `plugins/example-plugin` 这类目录结构。</p>
          <p>在 `lib/plugins.ts` 添加插件元数据，页面会自动出现。</p>
          <p>在插件自己的 `appscript` 目录里维护 Apps Script 和 manifest。</p>
        </div>
      </section>
    </main>
  );
}
