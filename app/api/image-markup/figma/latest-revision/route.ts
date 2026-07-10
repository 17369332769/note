import { getLatestCompletedAiRevisionJob } from "@/lib/image-markup/aiRevisionJobs";
import { assertAiRevisionSessionAccess } from "@/lib/image-markup/sessionAccess";
import { jsonWithCors, optionsWithCors } from "../../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || "";
  const sessionToken = searchParams.get("sessionToken") || "";

  if (!sessionId) return jsonWithCors({ ok: false, error: "sessionId is required." }, { status: 400 });
  if (!sessionToken) return jsonWithCors({ ok: false, error: "sessionToken is required." }, { status: 400 });
  if (!sessionId.startsWith("figma-")) {
    return jsonWithCors({ ok: false, error: "A Figma editing session is required." }, { status: 403 });
  }

  try {
    await assertAiRevisionSessionAccess({ sessionId, sessionToken });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Invalid editing session." },
      { status: 403 },
    );
  }

  try {
    const job = await getLatestCompletedAiRevisionJob({ sessionId });
    if (!job?.revisedImageR2Key || !job.revisedImageUrl) {
      return jsonWithCors(
        { ok: false, error: "No completed Figma revision was found for this session." },
        { status: 404 },
      );
    }

    return jsonWithCors({
      ok: true,
      jobId: job.jobId,
      revisedImageR2Key: job.revisedImageR2Key,
      revisedImageUrl: job.revisedImageUrl,
      generatedAt: job.generatedAt,
    });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not load the latest Figma revision." },
      { status: 503 },
    );
  }
}
