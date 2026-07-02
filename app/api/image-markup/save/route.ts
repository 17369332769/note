import { jsonWithCors, optionsWithCors } from "../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  const callbackUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  const payload = await request.json();

  if (!callbackUrl) {
    return jsonWithCors(
      {
        ok: false,
        error: "APPS_SCRIPT_WEBAPP_URL is not configured.",
      },
      { status: 503 },
    );
  }

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  try {
    return jsonWithCors(JSON.parse(text), { status: response.status });
  } catch {
    return jsonWithCors({ ok: response.ok, response: text }, { status: response.status });
  }
}
