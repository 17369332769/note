import { neon } from "@neondatabase/serverless";

const defaultSessionLimit = 10;

type SqlClient = ReturnType<typeof getSqlClient>;

type SessionLimitRow = {
  generation_count: number;
  generation_limit: number;
  reset_at: string | Date;
  quota_allowed: boolean;
};

export type SessionLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

export async function consumeAiRevisionSessionQuota(input: { sessionId: string; resetAt?: string }) {
  const sql = getSqlClient();
  await ensureSessionUsageTable(sql);

  const limit = getSessionLimit();
  const resetAt = normalizeResetAt(input.resetAt);
  const rows = await sql`
    with upserted as (
      insert into image_markup_ai_session_usage (
        session_id,
        generation_count,
        generation_limit,
        reset_at
      )
      values (
        ${input.sessionId},
        1,
        ${limit},
        ${resetAt}
      )
      on conflict (session_id) do update
      set
        generation_count = case
          when image_markup_ai_session_usage.reset_at <= now() then 1
          else image_markup_ai_session_usage.generation_count + 1
        end,
        generation_limit = excluded.generation_limit,
        reset_at = case
          when image_markup_ai_session_usage.reset_at <= now() then excluded.reset_at
          else image_markup_ai_session_usage.reset_at
        end,
        updated_at = now()
      where
        image_markup_ai_session_usage.reset_at <= now()
        or image_markup_ai_session_usage.generation_count < ${limit}
      returning generation_count, generation_limit, reset_at, true as quota_allowed
    )
    select generation_count, generation_limit, reset_at, quota_allowed from upserted
    union all
    select generation_count, generation_limit, reset_at, false as quota_allowed
    from image_markup_ai_session_usage
    where session_id = ${input.sessionId}
      and not exists (
        select 1 from upserted
        )
    limit 1
  `;

  const row = rows[0] as SessionLimitRow | undefined;
  if (!row) {
    throw new Error("Could not read generation limit state.");
  }

  const count = Number(row.generation_count);
  const rowLimit = Number(row.generation_limit);
  const allowed = row.quota_allowed === true;
  return {
    allowed,
    count,
    limit: rowLimit,
    remaining: Math.max(0, rowLimit - count),
    resetAt: toIsoString(row.reset_at),
  } satisfies SessionLimitResult;
}

function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(databaseUrl);
}

async function ensureSessionUsageTable(sql: SqlClient) {
  await sql`
    create table if not exists image_markup_ai_session_usage (
      session_id text primary key,
      generation_count integer not null default 0,
      generation_limit integer not null default 10,
      reset_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

function getSessionLimit() {
  const configured = Number(process.env.IMAGE_MARKUP_AI_SESSION_LIMIT || defaultSessionLimit);
  if (!Number.isFinite(configured)) return defaultSessionLimit;
  return Math.max(1, Math.min(100, Math.floor(configured)));
}

function normalizeResetAt(resetAt?: string) {
  const parsed = resetAt ? new Date(resetAt).getTime() : NaN;
  if (Number.isFinite(parsed) && parsed > Date.now()) return new Date(parsed).toISOString();
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
