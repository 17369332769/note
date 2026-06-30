import { jsonWithCors, optionsWithCors } from "../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function GET(request: Request) {
  const callbackUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return jsonWithCors({ ok: false, error: "sessionId is required." }, { status: 400 });
  }

  if (!callbackUrl) {
    return jsonWithCors({ ok: false, error: "APPS_SCRIPT_WEBAPP_URL is not configured." }, { status: 503 });
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("includeImage", "1");

  const response = await fetch(url);
  const text = await response.text();

  try {
    return jsonWithCors(JSON.parse(text), { status: response.status });
  } catch {
    return jsonWithCors({ ok: false, error: text }, { status: response.status });
  }
}
