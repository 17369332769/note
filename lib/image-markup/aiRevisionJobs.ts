import { neon } from "@neondatabase/serverless";

import type { AiRevisionMetadata } from "./types";

export type AiRevisionJobStatus = "creating" | "pending" | "completed" | "failed";

export type AiRevisionJob = {
  jobId: string;
  requestId: string;
  sessionId: string;
  provider: AiRevisionMetadata["provider"];
  status: AiRevisionJobStatus;
  taskId: string;
  promptVersion: AiRevisionMetadata["promptVersion"];
  promptHash: string;
  resolution: string;
  quality: string;
  model?: string;
  revisedImageR2Key?: string;
  revisedImageUrl?: string;
  error?: string;
  generatedAt?: string;
};

type SqlClient = ReturnType<typeof getSqlClient>;

type AiRevisionJobRow = {
  job_id: string;
  request_id: string;
  session_id: string;
  provider: AiRevisionMetadata["provider"];
  status: AiRevisionJobStatus;
  task_id: string | null;
  prompt_version: AiRevisionMetadata["promptVersion"];
  prompt_hash: string;
  resolution: string;
  quality: string;
  model: string | null;
  revised_image_r2_key: string | null;
  revised_image_url: string | null;
  error: string | null;
  generated_at: string | Date | null;
};

export async function createOrGetAiRevisionJob(input: {
  requestId: string;
  sessionId: string;
  provider: AiRevisionMetadata["provider"];
  promptHash: string;
  resolution: string;
  quality: string;
  model?: string;
}) {
  const sql = getSqlClient();
  await ensureAiRevisionJobsTable(sql);

  const jobId = crypto.randomUUID();
  const rows = await sql`
    with inserted as (
      insert into image_markup_ai_revision_jobs (
        job_id,
        request_id,
        session_id,
        provider,
        status,
        prompt_version,
        prompt_hash,
        resolution,
        quality,
        model
      )
      values (
        ${jobId},
        ${input.requestId},
        ${input.sessionId},
        ${input.provider},
        'creating',
        'image-markup-ai-edit-v1',
        ${input.promptHash},
        ${input.resolution},
        ${input.quality},
        ${input.model || null}
      )
      on conflict (session_id, request_id) do nothing
      returning *, true as created
    )
    select *, created from inserted
    union all
    select *, false as created
    from image_markup_ai_revision_jobs
    where session_id = ${input.sessionId}
      and request_id = ${input.requestId}
      and not exists (select 1 from inserted)
    limit 1
  `;

  const row = rows[0] as (AiRevisionJobRow & { created: boolean }) | undefined;
  if (!row) throw new Error("Could not create AI revision job.");
  return {
    created: row.created === true,
    job: mapJobRow(row),
  };
}

export async function getAiRevisionJob(input: { sessionId: string; jobId: string }) {
  const sql = getSqlClient();
  await ensureAiRevisionJobsTable(sql);

  const rows = await sql`
    select *
    from image_markup_ai_revision_jobs
    where session_id = ${input.sessionId}
      and job_id = ${input.jobId}
    limit 1
  `;
  const row = rows[0] as AiRevisionJobRow | undefined;
  return row ? mapJobRow(row) : null;
}

export async function markAiRevisionJobPending(input: { sessionId: string; jobId: string; taskId: string }) {
  const sql = getSqlClient();
  await ensureAiRevisionJobsTable(sql);

  const rows = await sql`
    update image_markup_ai_revision_jobs
    set
      status = 'pending',
      task_id = ${input.taskId},
      updated_at = now()
    where session_id = ${input.sessionId}
      and job_id = ${input.jobId}
    returning *
  `;
  const row = rows[0] as AiRevisionJobRow | undefined;
  if (!row) throw new Error("Could not update AI revision job.");
  return mapJobRow(row);
}

export async function markAiRevisionJobCompleted(input: {
  sessionId: string;
  jobId: string;
  revisedImageR2Key: string;
  revisedImageUrl: string;
}) {
  const sql = getSqlClient();
  await ensureAiRevisionJobsTable(sql);

  const rows = await sql`
    update image_markup_ai_revision_jobs
    set
      status = 'completed',
      revised_image_r2_key = ${input.revisedImageR2Key},
      revised_image_url = ${input.revisedImageUrl},
      generated_at = now(),
      updated_at = now()
    where session_id = ${input.sessionId}
      and job_id = ${input.jobId}
    returning *
  `;
  const row = rows[0] as AiRevisionJobRow | undefined;
  if (!row) throw new Error("Could not complete AI revision job.");
  return mapJobRow(row);
}

export async function markAiRevisionJobFailed(input: { sessionId: string; jobId: string; error: string }) {
  const sql = getSqlClient();
  await ensureAiRevisionJobsTable(sql);

  const rows = await sql`
    update image_markup_ai_revision_jobs
    set
      status = 'failed',
      error = ${input.error},
      updated_at = now()
    where session_id = ${input.sessionId}
      and job_id = ${input.jobId}
    returning *
  `;
  const row = rows[0] as AiRevisionJobRow | undefined;
  if (!row) throw new Error("Could not fail AI revision job.");
  return mapJobRow(row);
}

function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(databaseUrl);
}

async function ensureAiRevisionJobsTable(sql: SqlClient) {
  await sql`
    create table if not exists image_markup_ai_revision_jobs (
      job_id text primary key,
      request_id text not null,
      session_id text not null,
      provider text not null,
      status text not null,
      task_id text,
      prompt_version text not null,
      prompt_hash text not null,
      resolution text not null,
      quality text not null,
      model text,
      revised_image_r2_key text,
      revised_image_url text,
      error text,
      generated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (session_id, request_id)
    )
  `;
}

function mapJobRow(row: AiRevisionJobRow): AiRevisionJob {
  return {
    jobId: row.job_id,
    requestId: row.request_id,
    sessionId: row.session_id,
    provider: row.provider,
    status: row.status,
    taskId: row.task_id || "",
    promptVersion: row.prompt_version,
    promptHash: row.prompt_hash,
    resolution: row.resolution,
    quality: row.quality,
    model: row.model || undefined,
    revisedImageR2Key: row.revised_image_r2_key || undefined,
    revisedImageUrl: row.revised_image_url || undefined,
    error: row.error || undefined,
    generatedAt: row.generated_at ? toIsoString(row.generated_at) : undefined,
  };
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
