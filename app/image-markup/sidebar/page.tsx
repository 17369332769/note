"use client";

import { Button, ConfigProvider, Radio, Tabs, Upload as AntUpload } from "antd";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import styles from "../ImageMarkup.module.css";

type SourceTab = "document" | "upload";
type SidebarAction =
  | "createDocsSelectedImageSession"
  | "createDocsUploadSession"
  | "openPreparedEditor";
type DocsImage = {
  label?: string;
  width?: number;
  height?: number;
  previewDataUrl?: string;
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
    throw new Error(result.error || "The image could not be uploaded. Please try again.");
  }

  return result.key;
}

export default function ImageMarkupSidebarPage() {
  const [activeTab, setActiveTab] = useState<SourceTab>("document");
  const [selectedPreview, setSelectedPreview] = useState<DocsImage>();
  const [documentSessionId, setDocumentSessionId] = useState("");
  const [uploadSessionId, setUploadSessionId] = useState("");
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectingDocumentImage, setSelectingDocumentImage] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const openSessionId = activeTab === "document" ? documentSessionId : uploadSessionId;

  function clearError() {
    setError("");
  }

  function showError(message: string) {
    setError(message);
  }

  function selectSourceTab(tab: SourceTab) {
    setActiveTab(tab);
    if (tab === "document") {
      clearError();
      return;
    }

    clearError();
  }

  async function chooseSelectedDocsImage() {
    setBusy(true);
    setSelectingDocumentImage(true);
    setSelectedPreview(undefined);
    setDocumentSessionId("");
    clearError();

    try {
      const result = await callSidebarBridge<{ sessionId?: string; image?: DocsImage }>("createDocsSelectedImageSession");
      if (!result.sessionId) throw new Error("Select an inline image in the document, then try again.");
      setDocumentSessionId(result.sessionId);
      setSelectedPreview(result.image);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Select an inline image in the document, then try again.");
    } finally {
      setBusy(false);
      setSelectingDocumentImage(false);
    }
  }

  async function handleUpload(file: File) {
    setUploadSessionId("");
    setUploadPreviewUrl("");

    if (!supportedTypes.includes(file.type)) {
      showError("Use a PNG, JPEG, or WebP image.");
      return;
    }

    setUploadPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    clearError();

    try {
      const r2Key = await uploadFileToR2(file, "image-markup/source");
      const result = await callSidebarBridge<{ sessionId?: string }>("createDocsUploadSession", {
        name: file.name,
        mimeType: file.type,
        r2Key,
        size: file.size,
      });
      if (!result.sessionId) throw new Error("Could not get this image ready for editing. Please try again.");
      setUploadSessionId(result.sessionId);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Could not get this image ready for editing. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPreparedEditor() {
    if (activeTab === "document" && !documentSessionId) {
      await chooseSelectedDocsImage();
      return;
    }
    if (!openSessionId) return;
    setBusy(true);
    setOpeningEditor(true);
    clearError();

    try {
      await callSidebarBridge("openPreparedEditor", { sessionId: openSessionId });
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Could not start editing. Please try again.");
    } finally {
      setBusy(false);
      setOpeningEditor(false);
    }
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#2563eb" } }}>
      <main className={styles.workspaceSidebarShell}>
      <Tabs
        activeKey={activeTab}
        className={styles.sourceTabs}
        items={[
          { key: "document", label: "Document" },
          { key: "upload", label: "Upload" },
        ]}
        onChange={(key) => selectSourceTab(key as SourceTab)}
      />

      <div className={styles.sidebarContent}>
        {activeTab === "document" ? (
          <section className={styles.uploadPanel}>
            <div className={styles.sourceState}>
              <Radio checked className={styles.sourceStateRadio} tabIndex={-1}>
                {documentSessionId ? "Image ready. Edit to mark your changes." : "Select an image in this Doc, then use it here."}
              </Radio>
            </div>
            {selectedPreview?.previewDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Selected document image preview" className={styles.sidebarPreview} src={selectedPreview.previewDataUrl} />
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
                <strong>{busy ? "Uploading image..." : "Choose image file"}</strong>
                <span>PNG, JPEG, or WebP</span>
              </div>
            </AntUpload.Dragger>
            {uploadPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Selected image preview" className={styles.sidebarPreview} src={uploadPreviewUrl} />
            ) : null}
          </section>
        )}
      </div>

      <div className={styles.sidebarFooter}>
        <Button
          block
          className={styles.editorSave}
          disabled={(activeTab === "upload" && !openSessionId) || (busy && !selectingDocumentImage && !openingEditor)}
          loading={selectingDocumentImage || openingEditor}
          onClick={openPreparedEditor}
          type="primary"
        >
          {activeTab === "document" && !documentSessionId ? "Select image" : "Edit"}
        </Button>

        {error ? <p className={styles.editorStatus}>{error}</p> : null}
      </div>
      </main>
    </ConfigProvider>
  );
}
