# StudyFlow Testing Checklist

Run the app (`npm run dev`), then work through this checklist. Mark each item as you verify it. Every milestone should re-run the previously passing sections.

## Application

- [ ] Application launches (dev server at http://127.0.0.1:1420)
- [ ] Onboarding shows on first launch
- [ ] "Continue in Development Mode" reaches the dashboard
- [ ] Sidebar navigation works (every page)
- [ ] Mock data loads and is clearly labeled
- [ ] Light / dark / system theme switching works

## Assignments & tasks

- [ ] Assignment creation (manual)
- [ ] Assignment editing (manual)
- [ ] Assignment completion (and reopen)
- [ ] Assignment deletion (with confirmation)
- [ ] Assignment details view (click a row)
- [ ] Filters: all / today / tomorrow / this week / overdue / completed
- [ ] Sorting: due / priority / duration / class
- [ ] Global search finds assignments and classes

## Planner

- [ ] Auto Plan generates a schedule
- [ ] Overload warning when work exceeds available time
- [ ] Unscheduleable work is reported, not hidden
- [ ] Accept / Regenerate / Cancel work
- [ ] Accepted plan persists after reload

## Focus Mode

- [ ] Timer starts, pauses, resumes
- [ ] Finish records a session and marks the task complete
- [ ] Exit records a stopped session without completing the task
- [ ] Pomodoro break timer appears after finishing
- [ ] Session history shows past sessions
- [ ] Focus sessions persist after reload

## Analytics & Goals

- [ ] Analytics reflect real sessions and completions
- [ ] Goal creation, progress, and deletion

## Data controls

- [ ] Export produces a JSON file
- [ ] Delete local data requires confirmation and clears app data
- [ ] Reset application requires confirmation and restores onboarding

## Google Classroom

- [ ] Unconfigured state shows setup instructions (no fake connection)
- [ ] Connect flow uses the Google popup (never a password field)
- [ ] Only Classroom scopes are requested
- [ ] Sync Now shows progress steps
- [ ] Duplicate prevention: repeated syncs do not duplicate rows
- [ ] Sync failure keeps existing data
- [ ] Offline state shows saved data
- [ ] Token expiry shows a reconnect prompt
- [ ] Disconnect works and keeps local data

## Calendar / AI

- [ ] Calendar page is honest about its connection state
- [ ] AI page recommends a grounded next task
- [ ] AI unavailability does not break the app (no backend configured is a valid state)

## Production

- [ ] `npm run build` passes
- [ ] `npm run tauri build` produces the installer
- [ ] Installer installs on a clean Windows machine (no Node/Python/Rust)
- [ ] Installer uninstalls cleanly
- [ ] Website shows "coming soon" until a real download URL is configured
- [ ] No secrets in the repository (`grep` for keys, tokens)
