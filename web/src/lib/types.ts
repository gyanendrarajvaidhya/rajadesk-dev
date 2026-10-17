// Shapes returned by ../../server (GET /api/*). Keep in step with server/work.mjs and server/github.mjs.

export type Status = {
  raja: {
    signedIn: boolean
    signingIn: boolean
    lastLogin: { ok: boolean; at: number; error: string | null } | null
    email: string | null
    name: string | null
    devId?: string
    githubUsername?: string | null
    error: string | null
    expired?: boolean
  }
  github: {
    connected: boolean
    login?: string
    name?: string | null
    avatar?: string
    scopes?: string[]
    savedAt?: string
    error?: string | null
  }
  update: { current: string; latest: string | null; available: boolean; command: string }
  newTokenUrl: string
}

export type ChecklistItem = { id: string; label: string; checked: boolean }

export type Task = {
  id: string
  title: string
  status: string
  priority: string | null
  story_points: number | null
  sp_approved: boolean
  deadline: string | null
  assigned_to: string | null
  epic_id: string
  type: string | null
  created_at: string
  updated_at: string
  assignee: string | null
  mine: boolean
  checklist: ChecklistItem[]
  checklist_done: number
  elapsed_seconds: number
  my_seconds: number
  timer_running: boolean
  running_since: string | null
  running_by: string | null
  running_by_me: boolean
  overdue: boolean
  due_today: boolean
  epic_hid: string
  epic_title: string
  prs: { id: string; pr_url: string; label: string; state: string | null; merged_at: string | null }[]
}

export type Ticket = {
  id: string
  human_id: string
  title: string
  status: string
  priority: string | null
  type: string | null
  project: string
  open: boolean
  sla_breached: boolean
  sla_breached_codes: string[]
  sla_at_risk: boolean
  url: string
}

export type EpicPr = { id: string; pr_url: string; label: string; state: string | null; opened_at: string | null; merged_at: string | null }

export type Epic = {
  id: string
  human_id: string
  seq: number
  title: string
  status: string
  priority: string | null
  kind: string | null
  deadline: string | null
  planned_start: string | null
  owner_id: string | null
  project: string
  owner: string | null
  owned_by_me: boolean
  created_at: string
  updated_at: string
  closed_at: string | null
  assignees: { id: string; name: string; acked: boolean }[]
  acks: { id: string; name: string; acked: boolean; at: string | null; owner: boolean; me: boolean }[]
  needs_my_ack: boolean
  acked_at: string | null
  tickets: Ticket[]
  prs: EpicPr[]
  tasks: Task[]
  all_tasks_done: boolean
  overdue: boolean
  url: string
}

export type EpicDetail = Epic & { description: string; comments: { author: string; body_text: string; created_at: string }[] }

export type Work = {
  me: { id: string; name: string; email: string; level: string | null; github_username: string | null }
  today: string
  epics: Epic[]
  time: { today: number; week: number; days: Record<string, number>; weekStart: string } | null
}

export type Pr = {
  url: string
  number: number
  title: string
  repo: string
  draft: boolean
  author: string
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  comments: number
}

export type Push = { id: string; repo: string; branch: string; at: string; count: number; commits: { sha: string; message: string }[]; url: string }

export type Github = { login: string; open: Pr[]; reviews: Pr[]; merged: Pr[]; pushes: Push[]; fetched_at: string }
