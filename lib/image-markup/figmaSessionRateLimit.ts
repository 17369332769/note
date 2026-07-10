import { neon } from "@neondatabase/serverless";

const defaultWindowSeconds = 2 * 60 * 60;

type SqlClient = ReturnType<typeof getSqlClient>;

type FigmaSessionLimitRow = {
  issue_count: number;
  issue_limit: number;
  reset_at: string | Date;
  quota_allowed: boolean;
};

export type FigmaSessionLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

export async function consumeFigmaSessionIssueQuota(input: { limiterKey: string }) {
  const sql = getSqlClient();
  await ensureFigmaSessionUsageTable(sql);

  const limit = getFigmaSessionLimit();
  const resetAt = new Date(Date.now() + getFigmaSessionWindowSeconds() * 1000).toISOString();
  const rows = await sql`
    with upserted as (
      insert into image_markup_figma_session_usage (
        limiter_key,
        issue_count,
        issue_limit,
        reset_at
      )
      values (
        ${input.limiterKey},
        1,
        ${limit},
        ${resetAt}
      )
      on conflict (limiter_key) do update
      set
        issue_count = case
          when image_markup_figma_session_usage.reset_at <= now() then 1
          else image_markup_figma_session_usage.issue_count + 1
        end,
        issue_limit = excluded.issue_limit,
        reset_at = case
          when image_markup_figma_session_usage.reset_at <= now() then excluded.reset_at
          else image_markup_figma_session_usage.reset_at
        end,
        updated_at = now()
      where
        image_markup_figma_session_usage.reset_at <= now()
        or image_markup_figma_session_usage.issue_count < ${limit}
      returning issue_count, issue_limit, reset_at, true as quota_allowed
    )
    select issue_count, issue_limit, reset_at, quota_allowed from upserted
    union all
    select issue_count, issue_limit, reset_at, false as quota_allowed
    from image_markup_figma_session_usage
    where limiter_key = ${input.limiterKey}
      and not exists (
        select 1 from upserted
      )
    limit 1
  `;

  const row = rows[0] as FigmaSessionLimitRow | undefined;
  if (!row) {
    throw new Error("Could not read Figma session limit state.");
  }

  const count = Number(row.issue_count);
  const rowLimit = Number(row.issue_limit);
  const allowed = row.quota_allowed === true;
  return {
    allowed,
    count,
    limit: rowLimit,
    remaining: Math.max(0, rowLimit - count),
    resetAt: toIsoString(row.reset_at),
  } satisfies FigmaSessionLimitResult;
}

function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(databaseUrl);
}

async function ensureFigmaSessionUsageTable(sql: SqlClient) {
  await sql`
    create table if not exists image_markup_figma_session_usage (
      limiter_key text primary key,
      issue_count integer not null default 0,
      issue_limit integer not null default 30,
      reset_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

function getFigmaSessionLimit() {
  const configured = Number(process.env.IMAGE_MARKUP_FIGMA_SESSION_LIMIT || process.env.IMAGE_MARKUP_AI_SESSION_LIMIT || 10);
  if (!Number.isFinite(configured)) return 10;
  return Math.max(1, Math.min(500, Math.floor(configured)));
}

function getFigmaSessionWindowSeconds() {
  const configured = Number(
    process.env.IMAGE_MARKUP_FIGMA_SESSION_WINDOW_SECONDS ||
      process.env.IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS ||
      defaultWindowSeconds,
  );
  if (!Number.isFinite(configured)) return defaultWindowSeconds;
  return Math.max(60, Math.min(24 * 60 * 60, Math.floor(configured)));
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
