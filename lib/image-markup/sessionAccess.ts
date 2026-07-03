import type { AiRevisionRequest } from "./types";

type AppsScriptSessionResponse = {
  ok?: boolean;
  error?: string;
  session?: {
    id?: string;
    expiresAt?: string;
  } | null;
};

export async function assertAiRevisionSessionAccess(payload: Pick<AiRevisionRequest, "sessionId" | "sessionToken">) {
  if (payload.sessionId === "local-session") {
    if (process.env.NODE_ENV !== "production" || process.env.IMAGE_MARKUP_ALLOW_LOCAL_AI === "1") return;
    throw new Error("A verified editing session is required.");
  }

  if (!payload.sessionToken) {
    throw new Error("sessionToken is required.");
  }

  const callbackUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  if (!callbackUrl) {
    throw new Error("APPS_SCRIPT_WEBAPP_URL is not configured.");
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("api", "session");
  url.searchParams.set("sessionId", payload.sessionId);
  url.searchParams.set("sessionToken", payload.sessionToken);

  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  const json = parseSessionResponse(text);

  if (!response.ok || !json.ok || json.session?.id !== payload.sessionId) {
    throw new Error(json.error || "Invalid or expired editing session.");
  }

  if (json.session.expiresAt && new Date(json.session.expiresAt).getTime() < Date.now()) {
    throw new Error("Editing session has expired.");
  }
}

function parseSessionResponse(text: string): AppsScriptSessionResponse {
  if (/^\s*<!doctype html/i.test(text) || /accounts\.google\.com|signin/i.test(text)) {
    return {
      ok: false,
      error: "Could not verify editing session. Check APPS_SCRIPT_WEBAPP_URL access settings.",
    };
  }

  try {
    return JSON.parse(text) as AppsScriptSessionResponse;
  } catch {
    return { ok: false, error: text || "Could not verify editing session." };
  }
}
