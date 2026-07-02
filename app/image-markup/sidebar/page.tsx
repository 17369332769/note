"use client";

import { Upload as AntUpload } from "antd";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "../ImageMarkup.module.css";

type SourceTab = "document" | "upload";
type SidebarAction = "listDocsImages" | "createDocsImageSession" | "createDocsUploadSession" | "openPreparedEditor";
type DocsImage = {
  label?: string;
  width?: number;
  height?: number;
};
type R2UploadUrlResponse = {
  ok?: boolean;
  error?: string;
  key?: string;
};

const supportedTypes = ["image/png", "image/jpeg", "image/webp"];

function callSidebarBridge<T>(action: SidebarAction, payload: unknown = {}) {
  return new Promise<T>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("Apps Script bridge timed out."));
    }, 60000);

    function handleMessage(event: MessageEvent) {
      const message = event.data;
      if (!message || message.type !== "image-markup-sidebar-response" || message.id !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      if (message.ok) {
        resolve(message.result as T);
      } else {
        reject(new Error(message.error || "Apps Script request failed."));
      }
    }

    window.addEventListener("message", handleMessage);
    window.parent.postMessage(
      {
        type: "image-markup-sidebar-request",
        id: requestId,
        action,
        payload,
      },
      "*",
    );
  });
}

async function uploadFileToR2(file: File, prefix: string) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("filename", file.name);
  formData.set("prefix", prefix);
  formData.set("contentType", file.type || "image/png");

  const response = await fetch("/api/image-markup/r2/upload", {
    method: "POST",
    body: formData,
  });
  const result = (await response.json().catch(() => ({}))) as R2UploadUrlResponse;
  if (!response.ok || !result.ok || !result.key) {
    throw new Error(result.error || "图片上传失败，请重试。");
  }

  return result.key;
}

export default function ImageMarkupSidebarPage() {
  const [activeTab, setActiveTab] = useState<SourceTab>("document");
  const [docsImages, setDocsImages] = useState<DocsImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>();
  const [documentSessionId, setDocumentSessionId] = useState("");
  const [uploadSessionId, setUploadSessionId] = useState("");
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [status, setStatus] = useState("从当前文档中选择一张图片。");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openSessionId = activeTab === "document" ? documentSessionId : uploadSessionId;

  const statusText = useMemo(() => error || status, [error, status]);

  function showStatus(message: string) {
    setError("");
    setStatus(message);
  }

  function showError(message: string) {
    setError(message);
  }

  function selectSourceTab(tab: SourceTab) {
    setActiveTab(tab);
    if (tab === "document") {
      showStatus(documentSessionId ? "文档图片已准备好，可以打开大画布。" : "从当前文档中选择一张图片。");
      return;
    }

    showStatus(uploadSessionId ? "图片已准备好，可以打开大画布。" : "上传一张 PNG、JPEG 或 WebP 图片。");
  }

  async function loadDocsImages() {
    setBusy(true);
    setDocsImages([]);
    setSelectedImageIndex(undefined);
    setDocumentSessionId("");
    showStatus("正在读取文档图片...");

    try {
      const result = await callSidebarBridge<{ images?: DocsImage[] }>("listDocsImages");
      const images = result.images || [];
      setDocsImages(images);
      showStatus(images.length ? "请选择一张文档图片。" : "当前文档中没有找到图片。");
      if (!images.length) showError("当前文档中没有找到图片。");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "读取失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function chooseDocsImage(index: number) {
    setBusy(true);
    setSelectedImageIndex(index);
    setDocumentSessionId("");
    showStatus("正在准备文档图片...");

    try {
      const result = await callSidebarBridge<{ sessionId?: string }>("createDocsImageSession", { imageIndex: index });
      if (!result.sessionId) throw new Error("图片准备失败，请重试。");
      setDocumentSessionId(result.sessionId);
      showStatus("文档图片已准备好，可以打开大画布。");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "图片准备失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    setUploadSessionId("");
    setUploadPreviewUrl("");

    if (!supportedTypes.includes(file.type)) {
      showError("仅支持 PNG、JPEG 或 WebP 图片。");
      return;
    }

    setUploadPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    showStatus("正在上传图片...");

    try {
      const r2Key = await uploadFileToR2(file, "image-markup/source");
      const result = await callSidebarBridge<{ sessionId?: string }>("createDocsUploadSession", {
        name: file.name,
        mimeType: file.type,
        r2Key,
        size: file.size,
      });
      if (!result.sessionId) throw new Error("图片准备失败，请重试。");
      setUploadSessionId(result.sessionId);
      showStatus("图片已准备好，可以打开大画布。");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "图片准备失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function openPreparedEditor() {
    if (!openSessionId) return;
    setBusy(true);
    showStatus("正在打开编辑器...");

    try {
      await callSidebarBridge("openPreparedEditor", { sessionId: openSessionId });
      showStatus("编辑器已打开。");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "打开失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.workspaceSidebarShell}>
      <div>
        <p className="eyebrow">Image Markup</p>
        <h1>选择图片</h1>
      </div>

      <div className={styles.sourceTabs} aria-label="Image source">
        <button aria-pressed={activeTab === "document"} onClick={() => selectSourceTab("document")} type="button">
          文档图片
        </button>
        <button aria-pressed={activeTab === "upload"} onClick={() => selectSourceTab("upload")} type="button">
          本地上传
        </button>
      </div>

      {activeTab === "document" ? (
        <section className={styles.uploadPanel}>
          <button className="button" disabled={busy} onClick={loadDocsImages} type="button">
            <ImageIcon size={18} />
            选择文档中的图片
          </button>
          {docsImages.length ? (
            <div className={styles.sidebarImageList}>
              {docsImages.map((image, index) => (
                <button
                  aria-pressed={selectedImageIndex === index}
                  className={styles.sidebarImageOption}
                  disabled={busy}
                  key={`${image.label || "image"}-${index}`}
                  onClick={() => chooseDocsImage(index)}
                  type="button"
                >
                  <strong>{image.label || `文档图片 ${index + 1}`}</strong>
                  <span>{image.width && image.height ? `${image.width} x ${image.height}` : "可标注"}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.uploadPanel}>
          <AntUpload.Dragger
            accept="image/png,image/jpeg,image/webp"
            beforeUpload={(file) => {
              void handleUpload(file);
              return false;
            }}
            className={styles.sidebarUpload}
            disabled={busy}
            maxCount={1}
            showUploadList={false}
          >
            <div className={styles.sidebarUploadContent}>
              <UploadCloud aria-hidden="true" size={20} />
              <strong>{busy ? "正在上传图片..." : "上传本地图片"}</strong>
              <span>PNG、JPEG 或 WebP</span>
            </div>
          </AntUpload.Dragger>
          {uploadPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Selected image preview" className={styles.sidebarPreview} src={uploadPreviewUrl} />
          ) : null}
        </section>
      )}

      {openSessionId ? (
        <button className={`button button--primary ${styles.editorSave}`} disabled={busy} onClick={openPreparedEditor} type="button">
          打开大画布
        </button>
      ) : null}

      <p className={error ? styles.editorStatus : styles.sidebarStatus}>{statusText}</p>
    </main>
  );
}
