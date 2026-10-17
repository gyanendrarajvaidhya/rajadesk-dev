# Raja Desk Dev

Raja Desk for developers. Each developer runs it on their own PC: their Raja epics, tasks and tickets in one place,
play / pause timers, status moves, and their GitHub PRs, reviews and pushes next to their work. Everything is done
as the signed-in developer, so Raja records it under their name.

## Install (once)

Needs Node.js 20+ and Google Chrome or Microsoft Edge. (Install from the tarball, not `git+https://…`: npm 11 links global git installs to a temp folder it then deletes.)

```
npm install -g --prefer-online https://github.com/gyanendrarajvaidhya/rajadesk-dev/archive/refs/heads/main.tar.gz
```

## Run (every day)

```
rajadesk --dev
```

Opens http://127.0.0.1:4646/. Keep the window open while you work; Ctrl+C or `rajadesk stop` stops it.

- **Raja sign-in:** click "Sign in to Raja". A Chrome (or Edge) window opens on Raja's normal SSO page; sign in and it
  closes by itself. When the session expires the same card comes back.
- **GitHub:** paste a personal access token on the GitHub page (the link opens GitHub's new-token page with `repo` and
  `read:org` ticked). If GitHub stops accepting it, the page asks for a new one.
- Sessions and the token are saved only on the PC, in `%USERPROFILE%\.rajadesk-dev\`.

## Update

Run the install command again (`--prefer-online` makes npm fetch the new tarball instead of its cached one). The Account page (and a banner) says when a newer version is out.

## Pages

- **Today:** the running timer, logged today / this week, new epics to acknowledge, overdue epics, SLA-breached
  tickets, overdue tasks, up next, GitHub snapshot.
- **Epics:** every epic you own, are assigned to or have a task in: New / Overdue / In progress / In review / Done
  (14 days). Acknowledge, add tasks, send the epic for review, link PRs, comment.
- **Tasks:** all your tasks in one list with Start / Play / Pause, Review, Done, Reopen and the Definition of Done.
- **GitHub:** PRs waiting for your review, your open PRs (with their Raja epic, or link one), merged PRs, pushes.
- **Account:** Raja and GitHub sign-ins, version and update command.

## Develop

```
npm install && npm --prefix web install
rajadesk --dev                # or: node bin/rajadesk.mjs --dev
npm run web:dev               # hot reload on http://127.0.0.1:5175 (proxies /api to :4646)
npm run build                 # builds web/ into public/ (committed: installs need no build step)
```

Server: `server/` (plain Node, `@supabase/supabase-js`, `playwright-core` for the sign-in window). UI: `web/`
(Vite + React + Tailwind v4 + shadcn/ui, from the Gyan folder's ui-kit). Raja rules mirror the Raja web app.
