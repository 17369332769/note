const runningHubAspectRatios = [
  "1:1",
  "1:2",
  "2:1",
  "1:3",
  "3:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "21:9",
  "9:21",
  "16:9",
] as const;

export function pickScalarString(value: unknown, paths: string[]) {
  for (const path of paths) {
    const found = findPath(value, path);
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number" && Number.isFinite(found)) return String(found);
  }
  return "";
}

export function normalizeRunningHubAspectRatio(value: string | undefined) {
  const fallback = "1:1";
  if (!value) return fallback;

  const normalized = value.trim();
  if (runningHubAspectRatios.includes(normalized as (typeof runningHubAspectRatios)[number])) {
    return normalized;
  }

  const ratio = parseAspectRatio(normalized);
  if (!ratio) return fallback;

  return runningHubAspectRatios.reduce((best, candidate) => {
    const candidateRatio = parseAspectRatio(candidate) || 1;
    const bestRatio = parseAspectRatio(best) || 1;
    const candidateDistance = Math.abs(Math.log(ratio / candidateRatio));
    const bestDistance = Math.abs(Math.log(ratio / bestRatio));
    return candidateDistance < bestDistance ? candidate : best;
  }, fallback);
}

export function describeRunningHubError(value: unknown) {
  const parts = [
    pickScalarString(value, ["errorMessage", "data.errorMessage", "message", "msg", "error"]),
    pickScalarString(value, ["errorCode", "data.errorCode", "code"]),
    pickScalarString(value, ["promptTips", "data.promptTips"]),
    stringifySmallObject(findPath(value, "failedReason") || findPath(value, "data.failedReason")),
  ].filter(Boolean);

  if (!parts.length) return "";
  return `RunningHub error: ${parts.join(" | ")}`;
}

function findPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
    if (current && typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, value);
}

function stringifySmallObject(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== null && entry !== "");
  if (!entries.length) return "";
  return JSON.stringify(Object.fromEntries(entries)).slice(0, 300);
}

function parseAspectRatio(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return 0;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return width / height;
}
