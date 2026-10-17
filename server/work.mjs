// Everything Raja holds for the signed-in developer, and the writes they can make. Payloads and rules mirror Raja's
// web app (same as Gyan's Raja Desk: tools/raja/lib/ops.mjs + dashboard/server.mjs). All calls run as the developer,
// so Raja's own row-level security decides what they can see and change.
import { raja } from "./raja.mjs";

export const RAJA = "https://raja.ko-tech.in";
const CLOSED_EPIC = ["done", "cancelled", "misc"];
const ACK_STATUSES = ["open", "in_progress", "reopened"];
const EPIC_COLS = "id,human_id,seq,title,status,priority,kind,deadline,planned_start,owner_id,project_id,updated_at,created_at,closed_at";
const STORY_POINTS = [1, 2, 3, 5, 8, 13];

const TASK_TRANSITIONS = {
  pending: ["in_progress", "blocked", "abandoned"],
  in_progress: ["in_review", "done", "blocked", "abandoned"],
  in_review: ["done", "reopened", "blocked"],
  done: ["reopened"],
  blocked: ["in_progress", "abandoned"],
  reopened: ["in_review", "done", "blocked", "abandoned"],
  abandoned: [],
};

const must = (r, what) => {
  if (r.error) throw new Error(what ? `${what}: ${r.error.message}` : r.error.message);
  return r.data;
};
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA");
const nonEmpty = (v, what) => {
  const s = String(v ?? "").trim();
  if (!s) throw Object.assign(new Error(`${what} is empty`), { status: 400 });
  return s;
};
/** Plain text → the ProseMirror doc Raja stores next to body_text (one paragraph per line). */
const textDoc = (text) => ({
  type: "doc",
  content: text.split(/\r?\n/).map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
});

async function findEpic(sb, hid, select = "*") {
  const id = String(hid).trim().toUpperCase().replace(/^(\d+)$/, "EPIC-$1");
  const { data, error } = await sb.from("v_epic_with_number").select(select).eq("human_id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw Object.assign(new Error(`Epic ${id} not found (or not visible to you).`), { status: 404 });
  return data;
}

// ---------- reads ----------

/** Epics the developer owns, is assigned to, or has a task in. Chunked id lookups keep URLs short. */
async function involvedEpics(sb, devId) {
  const [assigned, tasked, owned] = await Promise.all([
    sb.from("epic_assignments").select("epic_id").eq("developer_id", devId).then(must),
    sb.from("tasks").select("epic_id").eq("assigned_to", devId).is("deleted_at", null).then(must),
    sb.from("v_epic_with_number").select(EPIC_COLS).eq("owner_id", devId).is("deleted_at", null).then(must),
  ]);
  const byId = new Map(owned.map((e) => [e.id, e]));
  const extra = [...new Set([...assigned, ...tasked].map((x) => x.epic_id).filter((id) => id && !byId.has(id)))];
  for (let i = 0; i < extra.length; i += 80) {
    const rows = must(await sb.from("v_epic_with_number").select(EPIC_COLS).in("id", extra.slice(i, i + 80)).is("deleted_at", null));
    for (const e of rows) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => b.seq - a.seq);
}

/** Adds tasks (timers, DoD), assignees, acknowledgements, linked tickets (with SLA) and PRs to each epic. */
async function enrichEpics(c, epics) {
  const { sb, dir, me } = c;
  if (!epics.length) return [];
  const ids = epics.map((e) => e.id);
  const [tasks, asg, acks, links, items, prs] = await Promise.all([
    sb.from("tasks").select("id,title,status,priority,story_points,sp_approved,deadline,assigned_to,epic_id,type,created_at,updated_at")
      .in("epic_id", ids).is("deleted_at", null).order("created_at").then(must),
    sb.from("epic_assignments").select("epic_id,developer_id").in("epic_id", ids).then(must),
    sb.from("epic_acknowledgements").select("epic_id,developer_id,acknowledged_at").in("epic_id", ids).then(must),
    sb.from("ticket_links").select("epic_id,ticket_id").in("epic_id", ids).then(must),
    sb.from("dod_checklist_items").select("id,label,ordinal,task_type").eq("active", true).order("ordinal").then((r) => r.data ?? []),
    sb.from("epic_prs").select("id,epic_id,pr_url,state,opened_at,merged_at").in("epic_id", ids).then((r) => r.data ?? []),
  ]);
  const taskIds = tasks.map((t) => t.id);
  const ticketIds = [...new Set(links.map((l) => l.ticket_id).filter(Boolean))];
  const [elapsed, ticks, tickets, sla, taskPrs] = await Promise.all([
    taskIds.length ? sb.from("v_task_elapsed").select("task_id,developer_id,completed_seconds,running_since").in("task_id", taskIds).then(must) : [],
    taskIds.length ? sb.from("task_checklist_ticks").select("task_id,item_id").in("task_id", taskIds).then((r) => r.data ?? []) : [],
    ticketIds.length ? sb.from("v_ticket_with_number").select("id,human_id,title,status,priority,type,project_id").in("id", ticketIds).is("deleted_at", null).then(must) : [],
    // SLA is optional: if Raja doesn't let a developer read it, tickets simply show no SLA clock.
    ticketIds.length ? sb.from("v_ticket_sla_status").select("ticket_id,sla_code,threshold_hours,elapsed_hours,breached").in("ticket_id", ticketIds).then((r) => r.data ?? []) : [],
    taskIds.length ? sb.from("v_task_prs").select("id,task_id,pr_url,state,merged_at").in("task_id", taskIds).then((r) => r.data ?? []) : [],
  ]);

  const name = (id) => (id ? dir.devById.get(id)?.name ?? "?" : null);
  const ticked = new Set(ticks.map((t) => `${t.task_id}:${t.item_id}`));
  const today = localDate();
  const ticketById = new Map(tickets.map((t) => {
    const rows = sla.filter((s) => s.ticket_id === t.id);
    const open = !["resolved", "rejected"].includes(t.status);
    // Raja keeps one row per tier; past breaches stay breached after the ticket moves on.
    const breached = rows.filter((s) => s.breached).map((s) => s.sla_code);
    const live = rows.filter((s) => !s.breached && s.threshold_hours > 0).sort((a, b) => b.elapsed_hours / b.threshold_hours - a.elapsed_hours / a.threshold_hours)[0];
    return [t.id, {
      ...t, project: dir.projById.get(t.project_id)?.project_code ?? "?", open,
      sla_breached: open && breached.length > 0, sla_breached_codes: breached,
      sla_at_risk: open && !breached.length && !!live && live.elapsed_hours / live.threshold_hours >= 0.75,
      url: `${RAJA}/tickets/${t.id}`,
    }];
  }));

  return epics.map((e) => {
    const acked = new Map(acks.filter((a) => a.epic_id === e.id).map((a) => [a.developer_id, a.acknowledged_at]));
    const assigneeIds = asg.filter((a) => a.epic_id === e.id).map((a) => a.developer_id);
    const people = [...new Set([e.owner_id, ...assigneeIds].filter(Boolean))];
    const ts = tasks.filter((t) => t.epic_id === e.id).map((t) => {
      const cl = items.filter((i) => i.task_type === (t.type ?? "development"))
        .map((i) => ({ id: i.id, label: i.label, checked: ticked.has(`${t.id}:${i.id}`) }));
      const rows = elapsed.filter((x) => x.task_id === t.id);
      const runningRow = rows.find((x) => x.running_since);
      const open = !["done", "abandoned"].includes(t.status);
      return {
        ...t, assignee: name(t.assigned_to), mine: t.assigned_to === me.id,
        checklist: cl, checklist_done: cl.filter((i) => i.checked).length,
        elapsed_seconds: rows.reduce((s, x) => s + (x.completed_seconds ?? 0), 0),
        my_seconds: rows.filter((x) => x.developer_id === me.id).reduce((s, x) => s + (x.completed_seconds ?? 0), 0),
        timer_running: !!runningRow, running_since: runningRow?.running_since ?? null, running_by: name(runningRow?.developer_id),
        running_by_me: runningRow?.developer_id === me.id,
        overdue: open && !!t.deadline && t.deadline < today,
        due_today: open && t.deadline === today,
        epic_hid: e.human_id, epic_title: e.title,
        prs: taskPrs.filter((p) => p.task_id === t.id).map((p) => ({ ...p, label: p.pr_url.replace(/^https?:\/\/github\.com\//, "") })),
      };
    });
    return {
      ...e,
      project: dir.projById.get(e.project_id)?.project_code ?? "?",
      owner: name(e.owner_id), owned_by_me: e.owner_id === me.id,
      assignees: assigneeIds.map((id) => ({ id, name: name(id), acked: acked.has(id) })),
      acks: people.map((id) => ({ id, name: name(id), acked: acked.has(id), at: acked.get(id) ?? null, owner: id === e.owner_id, me: id === me.id })),
      needs_my_ack: ACK_STATUSES.includes(e.status) && people.includes(me.id) && !acked.has(me.id),
      acked_at: acked.get(me.id) ?? null,
      tickets: links.filter((l) => l.epic_id === e.id).map((l) => ticketById.get(l.ticket_id)).filter(Boolean),
      prs: prs.filter((p) => p.epic_id === e.id).map((p) => ({ ...p, label: p.pr_url.replace(/^https?:\/\/github\.com\//, "") })),
      tasks: ts,
      all_tasks_done: ts.length > 0 && ts.every((t) => t.status === "done"),
      overdue: !!e.deadline && e.deadline < today && !["in_review", ...CLOSED_EPIC].includes(e.status),
      url: `${RAJA}/epics/${e.id}`,
    };
  });
}

/** Seconds this developer logged today and this week (Mon–Sun), from Raja's play / pause log. */
async function timeLogged(sb, me) {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(day);
  week.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const logs = must(await sb.from("task_timer_logs").select("task_id,action,action_at").eq("developer_id", me.id)
    .gte("action_at", new Date(week.getTime() - 24 * 3600e3).toISOString()).order("action_at"));
  const out = { today: 0, week: 0, days: {} };
  const open = new Map(); // task_id → play time
  const add = (from, to) => {
    for (const [key, start] of [["week", week], ["today", day]]) {
      const s = Math.max(from, start.getTime());
      if (to > s) out[key] += (to - s) / 1000;
    }
    // Split per local day for the week strip.
    let t = Math.max(from, week.getTime());
    while (t < to) {
      const d = new Date(t);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const k = localDate(d);
      out.days[k] = (out.days[k] ?? 0) + (Math.min(to, next) - t) / 1000;
      t = next;
    }
  };
  for (const l of logs) {
    const t = new Date(l.action_at).getTime();
    if (l.action === "play") open.set(l.task_id, t);
    else if (open.has(l.task_id)) {
      add(open.get(l.task_id), t);
      open.delete(l.task_id);
    }
  }
  for (const t of open.values()) add(t, Date.now());
  return { today: Math.round(out.today), week: Math.round(out.week), days: out.days, weekStart: localDate(week) };
}

/** The whole dashboard in one call: open epics (+ finished in the last 14 days), tickets, time logged. */
export async function work() {
  const c = await raja();
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const rows = (await involvedEpics(c.sb, c.me.id))
    .filter((e) => !["cancelled", "misc", "draft"].includes(e.status) && (e.status !== "done" || (e.closed_at ?? e.updated_at) >= since));
  const [epics, time] = await Promise.all([enrichEpics(c, rows), timeLogged(c.sb, c.me).catch(() => null)]);
  return {
    me: { id: c.me.id, name: c.me.name, email: c.me.email, level: c.me.level, github_username: c.me.github_username },
    today: localDate(),
    epics,
    time,
  };
}

/** Epic drawer: the card data plus description, comments and attachments count. */
export async function epicDetail(hid) {
  const c = await raja();
  const e = await findEpic(c.sb, hid);
  const [[rich], cmts] = await Promise.all([
    enrichEpics(c, [e]),
    c.sb.from("comments").select("author_id,body_text,created_at").eq("parent_type", "epic").eq("parent_id", e.id).is("deleted_at", null).order("created_at").then((r) => r.data ?? []),
  ]);
  return {
    ...rich,
    description: e.description ?? "",
    comments: cmts.map((x) => ({ author: c.dir.devById.get(x.author_id)?.name ?? "?", body_text: x.body_text, created_at: x.created_at })),
  };
}

// ---------- writes ----------

async function taskChecklist(sb, taskId, taskType = "development") {
  const [items, ticks] = await Promise.all([
    sb.from("dod_checklist_items").select("id,label,ordinal").eq("task_type", taskType).eq("active", true).order("ordinal"),
    sb.from("task_checklist_ticks").select("item_id").eq("task_id", taskId),
  ]);
  const ticked = new Set(must(ticks).map((t) => t.item_id));
  return must(items).map((i) => ({ id: i.id, label: i.label, checked: ticked.has(i.id) }));
}

export async function setChecklistItem(taskId, itemId, checked) {
  const { sb, me } = await raja();
  if (checked) {
    const r = await sb.from("task_checklist_ticks").insert({ task_id: taskId, item_id: itemId, checked_by: me.id });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message); // already ticked is fine
  } else {
    must(await sb.from("task_checklist_ticks").delete().eq("task_id", taskId).eq("item_id", itemId));
  }
}

async function myRunningTasks(sb, me) {
  const logs = must(await sb.from("task_timer_logs").select("task_id,action,action_at").eq("developer_id", me.id)
    .gte("action_at", new Date(Date.now() - 30 * 864e5).toISOString()).order("action_at"));
  const last = new Map();
  for (const l of logs) last.set(l.task_id, l.action);
  return [...last].filter(([, a]) => a === "play").map(([id]) => id);
}

async function pauseTimer(sb, me, taskId) {
  must(await sb.from("task_timer_logs").insert({ task_id: taskId, developer_id: me.id, action: "pause" }), "pause timer");
}

/**
 * Play: starts a pending / blocked task (Raja needs a deadline for that), pauses any other running timer of yours
 * (one task at a time), then starts this task's timer through Raja's own timer-play function.
 */
export async function play(taskId) {
  const { sb, me } = await raja();
  const task = must(await sb.from("tasks").select("id,status,deadline,assigned_to").eq("id", taskId).single());
  if (task.assigned_to !== me.id) throw Object.assign(new Error("You can only run timers on your own tasks."), { status: 403 });
  if (["done", "abandoned", "in_review"].includes(task.status)) throw Object.assign(new Error(`This task is ${task.status.replace("_", " ")}: reopen it first.`), { status: 400 });
  if (["pending", "blocked"].includes(task.status)) await setTaskStatus(taskId, "in_progress");
  for (const id of await myRunningTasks(sb, me)) if (id !== taskId) await pauseTimer(sb, me, id);
  const { data, error } = await sb.functions.invoke("timer-play", { body: { task_id: taskId } });
  if (error) throw new Error("Couldn't start the timer. Try again.");
  if (data && data.ok === false) throw new Error(data.message ?? "Couldn't start the timer.");
}

export async function pause(taskId) {
  const { sb, me } = await raja();
  if (!(await myRunningTasks(sb, me)).includes(taskId)) return { already: true };
  await pauseTimer(sb, me, taskId);
}

/** Links a GitHub PR to a task (Raja's task_prs, same insert as epic_prs). A PR already on the task is a no-op. */
async function addTaskPr(sb, me, taskId, rawUrl) {
  const prUrl = normalizePrUrl(rawUrl);
  const existing = must(await sb.from("task_prs").select("id").eq("task_id", taskId).eq("pr_url", prUrl).limit(1));
  if (!existing.length) must(await sb.from("task_prs").insert({ id: crypto.randomUUID(), task_id: taskId, pr_url: prUrl, created_by: me.id }), "link PR");
}

/**
 * Same checks as Raja: allowed transitions, deadline to start, SP approved to finish, reason to reopen.
 * Review / Done: an optional PR link is added to the task first, and any unticked Definition of Done items are ticked
 * (Gyan, 2026-10-17: "PR optional, the 5 points auto checked").
 */
export async function setTaskStatus(taskId, to, reason, prUrl) {
  const { sb, me } = await raja();
  const task = must(await sb.from("tasks").select("id,status,deadline,sp_approved,type,assigned_to").eq("id", taskId).single());
  const allowed = TASK_TRANSITIONS[task.status] ?? [];
  if (!allowed.includes(to)) throw Object.assign(new Error(`Can't move a ${task.status} task to ${to}. Allowed: ${allowed.join(", ") || "none"}.`), { status: 400 });
  if (to === "in_progress" && !task.deadline) throw Object.assign(new Error("This task has no deadline. Set one in Raja before starting it."), { status: 400 });
  if (to === "in_review" || to === "done") {
    if (!task.sp_approved) throw Object.assign(new Error("Story points aren't approved yet. Ask your approver in Raja."), { status: 400 });
    if (String(prUrl ?? "").trim()) await addTaskPr(sb, me, taskId, prUrl);
    const left = (await taskChecklist(sb, taskId, task.type ?? "development")).filter((i) => !i.checked);
    for (const i of left) await setChecklistItem(taskId, i.id, true);
  }
  if (to === "reopened") {
    if (!reason?.trim()) throw Object.assign(new Error("A reason is required to reopen."), { status: 400 });
    must(await sb.rpc("reopen_task", { p_task_id: taskId, p_reason: reason.trim() }), "reopen task");
    return;
  }
  if (task.status === "in_progress" && task.assigned_to === me.id && (await myRunningTasks(sb, me)).includes(taskId)) await pauseTimer(sb, me, taskId);
  must(await sb.from("tasks").update({ status: to }).eq("id", taskId), "update task status");
}

export async function createTask(hid, b) {
  const { sb, me } = await raja();
  const e = await findEpic(sb, hid, "id,status");
  const sp = Number(b.sp ?? 1);
  if (!STORY_POINTS.includes(sp)) throw Object.assign(new Error(`Story points must be ${STORY_POINTS.join("/")}`), { status: 400 });
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline ?? "") ? b.deadline : null;
  const task = must(await sb.from("tasks").insert({
    epic_id: e.id, title: nonEmpty(b.title, "Title"), description: null, description_doc: null, created_by: me.id,
    assigned_to: me.id, status: "pending", priority: "p3", story_points: sp, deadline, planned_start: null, type: "development",
  }).select("id").single(), "create task");
  return { id: task.id };
}

export async function acknowledgeEpic(hid) {
  const { sb, me } = await raja();
  const e = await findEpic(sb, hid, "id");
  const r = await sb.from("epic_acknowledgements").insert({ epic_id: e.id, developer_id: me.id });
  if (r.error && r.error.code !== "23505") throw new Error(`acknowledge: ${r.error.message}`);
}

export async function submitForReview(hid) {
  const { sb } = await raja();
  const e = await findEpic(sb, hid, "id");
  must(await sb.rpc("submit_epic_for_review", { p_epic_id: e.id }), "submit for review");
}

export async function commentEpic(hid, text) {
  const { sb, me } = await raja();
  const body = nonEmpty(text, "Comment");
  const e = await findEpic(sb, hid, "id");
  must(await sb.from("comments").insert({ parent_type: "epic", parent_id: e.id, author_id: me.id, body_doc: textDoc(body), body_text: body }), "comment");
}

export function normalizePrUrl(raw) {
  const m = String(raw ?? "").trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i);
  if (!m) throw Object.assign(new Error("Paste a GitHub PR link like https://github.com/Katyayani-Organics/repo/pull/12"), { status: 400 });
  return `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
}

/** Same insert as Raja's epic page → Pull requests (Raja allows the epic owner, the project's PMs and admins). */
export async function addEpicPr(hid, rawUrl) {
  const { sb, me } = await raja();
  const prUrl = normalizePrUrl(rawUrl);
  const e = await findEpic(sb, hid, "id");
  const existing = must(await sb.from("epic_prs").select("id").eq("epic_id", e.id).eq("pr_url", prUrl).limit(1));
  if (existing.length) return { pr_url: prUrl, already: true };
  must(await sb.from("epic_prs").insert({ id: crypto.randomUUID(), epic_id: e.id, pr_url: prUrl, created_by: me.id }), "link PR");
  return { pr_url: prUrl };
}
