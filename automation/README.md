# CASCADIA overnight runner

A supervised local `launchd` job that works through `execution/TASK_QUEUE.json`, one bounded task per fire, committing each verified result to `~/cascadia`'s git history.

## What it does, precisely

Every 20 minutes (`StartInterval` in the plist), launchd runs `overnight-runner.sh` once. Each run:
1. Refuses to start if `automation/STOP` exists, another run holds `automation/runner.lock`, the repo isn't on `main`, or the working tree isn't clean.
2. Picks the next `pending` task from `execution/TASK_QUEUE.json` whose dependencies are all `done`.
3. Runs `claude -p` with that task's prompt (`automation/tasks/<id>.txt`), bounded by a timeout (`max_single_task_seconds` in `runner-config.json`).
4. Runs that task's test command.
5. On success: commits, marks the task `done`, updates `execution/PROGRESS.md`.
6. On failure: records it, retries on a later fire up to `max_retries_per_task`, then marks the task `blocked`, writes to `execution/BLOCKERS.md`, and **stops the runner** (writes `automation/STOP`) rather than risk compounding failures or committing over a dirty tree.
7. When the queue is fully done (or the next task is blocked), writes `execution/OVERNIGHT_SUMMARY.md` and stops.

One task per fire, never more, this keeps each unit of unattended work small, bounded, and independently verifiable, rather than one open-ended multi-hour prompt.

## Install

```
sed "s|__REPO__|$HOME/cascadia|g; s|__HOME__|$HOME|g" \
  automation/com.cascadia.overnight-runner.plist \
  > ~/Library/LaunchAgents/com.cascadia.overnight-runner.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.cascadia.overnight-runner.plist
```

## Check status

```
launchctl print gui/$(id -u)/com.cascadia.overnight-runner
tail -f logs/overnight/launchd.out.log
cat execution/TASK_QUEUE.json | python3 -m json.tool
```

## Stop

```
automation/stop-runner.sh
```

Writes the `STOP` sentinel and unloads the launchd job. Resume with the command it prints.

## What this does NOT do

- Does not survive the laptop's lid being closed (the Mac sleeps; launchd jobs pause and resume on wake, making zero progress while asleep). Requires the laptop to stay open, powered, and with idle sleep prevented (`caffeinate -i`).
- Does not retry a task indefinitely, 3 failures (`max_retries_per_task`) and it's marked `blocked`, and the whole runner stops rather than burning through the queue on a broken foundation.
- Does not run more than one task per fire, and never runs two fires concurrently (the `mkdir`-based lock is atomic and race-free).
- Does not touch any directory outside `~/cascadia`.
- Does not push anywhere, all commits are local only.
