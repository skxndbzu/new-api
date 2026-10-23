import { z } from 'zod'

const positive = z.number().int().positive()
const target = z.object({
  channel_id: positive,
  model: z.string().trim().min(1).max(256),
  protocol: z.literal('chat'),
})
export const policySchema = z.object({
  id: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(128),
  enabled: z.boolean(),
  channels: z.array(positive).min(1).max(256),
  models: z
    .array(z.string().max(256))
    .max(256)
    .transform((values) => values.map((v) => v.trim()).filter(Boolean)),
  keywords: z.array(z.string().max(256)).max(2048),
  sample_percent: z.number().min(0).max(100),
  rules: z.string().trim().min(1).max(16000),
  primary: target,
  fallback: target.nullish(),
  timeout_seconds: positive.max(120),
  retries: z.number().int().min(0).max(5),
  auto_restrict: z.boolean(),
  subject: z.enum(['user', 'token']),
  window_hours: positive.max(720),
  violation_count: positive.max(1000),
  min_severity: z.enum(['low', 'medium', 'high']),
  restriction_hours: positive.max(8760),
})
export type PolicyForm = z.infer<typeof policySchema>

export const configSchema = z
  .object({
    enabled: z.boolean(),
    queue_tasks: positive.max(4096),
    queue_bytes: positive.min(1 << 20).max(1 << 30),
    max_body_bytes: positive.min(1024).max(16 << 20),
    scan_bytes: positive.min(256),
    review_bytes: positive.min(256),
    workers: positive.max(16),
    global_concurrency: positive.max(64),
    daily_calls: positive.max(10000000),
    max_pending_tasks: positive.max(1000000),
    max_stored_bytes: positive.min(1 << 20).max(2 ** 40),
    daily_tokens: positive.max(1000000000000),
    pending_hours: positive.max(720),
    body_hours: positive.max(8760),
    evidence_hours: positive.max(8760),
    record_days: positive.max(3650),
  })
  .refine(
    (v) =>
      v.max_body_bytes <= v.queue_bytes &&
      v.scan_bytes <= v.max_body_bytes &&
      v.review_bytes <= v.scan_bytes &&
      v.evidence_hours >= v.body_hours
  )

export const restrictionSchema = z.object({
  subject: z.enum(['user', 'token']),
  subject_id: positive,
  channel_id: positive,
  reason: z.string().trim().min(1).max(500),
  hours: z.number().int().min(0).max(87600),
})
