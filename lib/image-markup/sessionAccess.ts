import type { AiRevisionRequest } from "./types";
import { verifyAiSessionToken } from "./sessionToken";

export async function assertAiRevisionSessionAccess(payload: Pick<AiRevisionRequest, "sessionId" | "sessionToken">) {
  if (payload.sessionId === "local-session") {
    if (process.env.NODE_ENV !== "production" || process.env.IMAGE_MARKUP_ALLOW_LOCAL_AI === "1") return;
    throw new Error("A verified editing session is required.");
  }

  if (!payload.sessionToken) {
    throw new Error("sessionToken is required.");
  }

  return verifyAiSessionToken(payload.sessionToken, payload.sessionId);
}
