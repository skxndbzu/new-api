export interface ModerationConfig {
  enabled: boolean
  queue_tasks: number
  queue_bytes: number
  max_body_bytes: number
  scan_bytes: number
  review_bytes: number
  workers: number
  global_concurrency: number
  max_pending_tasks: number
  max_stored_bytes: number
  daily_calls: number
  daily_tokens: number
  pending_hours: number
  body_hours: number
  evidence_hours: number
  record_days: number
}
export interface Target {
  channel_id: number
  model: string
  protocol: string
}
export interface Policy {
  id: number
  version: number
  name: string
  enabled: boolean
  channels: number[]
  models: string[]
  keywords: string[]
  sample_percent: number
  rules: string
  primary: Target
  fallback?: Target | null
  timeout_seconds: number
  retries: number
  auto_restrict: boolean
  subject: string
  window_hours: number
  violation_count: number
  min_severity: string
  restriction_hours: number
}
export interface ModerationTask {
  id: number
  request_id: string
  policy_id: number
  version: number
  user_id: number
  token_id: number
  channel_id: number
  model: string
  group: string
  created_at: number
  expires_at: number
  body_expires_at: number
  status: string
  verdict: string
  human_verdict: string
  severity: string
  categories: string
  needs_review: boolean
  complete: boolean
  selection: string
  error: string
  attempts: number
  input_tokens: number
  output_tokens: number
  unknown_usage: number
  is_test: boolean
}
export interface Content {
  messages: { index: number; role: string; text: string }[]
  coverage: {
    complete: boolean
    reasons: string[] | null
    original_bytes: number
    scanned_bytes: number
    reviewed_bytes: number
  }
  hits: string[]
}
export interface History {
  id: number
  kind: string
  verdict: string
  actor_id: number
  created_at: number
  channel_id: number
  model: string
  fingerprint: string
  input_tokens: number
  output_tokens: number
  detail?: {
    reason?: string
    note?: string
    evidence?: { message_index: number; quote: string }[]
  }
}
export interface Detail {
  task: ModerationTask
  content: Content | null
  policy: Policy
  history: History[]
  channel_attempts: {
    id: number
    number: number
    channel_id: number
    outcome: string
    status_code: number
  }[]
}
export interface Restriction {
  id: number
  subject: string
  subject_id: number
  channel_id: number
  reason: string
  created_at: number
  expires_at: number
  released_at: number
  actor_id: number
  source_task_id: number
  automatic: boolean
}
export interface ChannelOption {
  id: number
  name: string
  models: string
  status: number
  review_supported: boolean
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}
export interface Settings {
  config: ModerationConfig
  policies: Policy[]
  default_policy: Policy
}
export interface Overview {
  available: boolean
  healthy: boolean
  config?: ModerationConfig
  queue_tasks: number
  queue_bytes: number
  counters: { day: string; name: string; value: number }[]
  local_counters: Record<string, number>
  statuses: { name: string; count: number }[]
  verdicts: { name: string; count: number }[]
  budget: {
    calls: number
    tokens: number
    unknown_calls: number
    reserved_tokens: number
  }
  oldest_pending: number
  cost_usd: number | null
}
