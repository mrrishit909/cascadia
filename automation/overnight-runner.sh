#!/bin/bash
# CASCADIA overnight runner. Fired periodically by launchd (see
# com.cascadia.overnight-runner.plist). Each fire does AT MOST one bounded
# task from execution/TASK_QUEUE.json, then exits -- launchd fires again on
# its own schedule. This script never loops/sleeps internally.
set -uo pipefail

# launchd (and a plain `bash script.sh` invocation) does not source
# .zshrc/.bash_profile, so PATH is minimal and won't include ~/.local/bin
# (where `claude` lives) or Homebrew. Set it explicitly rather than assume
# an interactive shell's PATH -- this exact gap is what the mandatory trial
# run (Phase 13) caught: claude -p exited 127 (command not found) without it.
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# This Mac has no GNU `timeout`/`gtimeout` (confirmed: `which timeout` fails;
# macOS doesn't ship coreutils by default, and installing coreutils just to
# get `timeout` would be a new dependency for one feature bash can do itself).
# Portable replacement: background the command, poll for exit, kill on
# deadline. Usage: run_with_timeout SECONDS cmd arg1 arg2 ...
run_with_timeout() {
  local secs="$1"; shift
  "$@" &
  local cmd_pid=$!
  local waited=0
  while kill -0 "$cmd_pid" 2>/dev/null; do
    if [ "$waited" -ge "$secs" ]; then
      kill -TERM "$cmd_pid" 2>/dev/null
      sleep 2
      kill -KILL "$cmd_pid" 2>/dev/null
      wait "$cmd_pid" 2>/dev/null
      return 124  # same convention GNU timeout uses for "killed on deadline"
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$cmd_pid"
}

REPO="$HOME/cascadia"
cd "$REPO" || { echo "FATAL: cannot cd to $REPO" >&2; exit 1; }

LOCK="$REPO/automation/runner.lock"
STOP_FILE="$REPO/automation/STOP"
CONFIG="$REPO/automation/runner-config.json"
LOG_DIR="$REPO/logs/overnight"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/run-$TS.log"

mkdir -p "$LOG_DIR"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

if [ -f "$STOP_FILE" ]; then
  log "STOP file present ($STOP_FILE), exiting without action. Remove it to resume."
  exit 0
fi

# Single-writer lock: mkdir is atomic, so this is race-free across concurrent fires.
if ! mkdir "$LOCK" 2>/dev/null; then
  log "Lock held by another run (stale or genuinely concurrent), skipping this fire."
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>&1)"
if [ "$BRANCH" != "main" ]; then
  log "CRITICAL: not on main branch (got '$BRANCH'). Stopping runner for manual review."
  touch "$STOP_FILE"
  exit 1
fi

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  log "CRITICAL: working tree not clean at start of run. Stopping runner -- do not want to commit over unrelated changes or a prior failed run's partial state."
  log "$DIRTY"
  touch "$STOP_FILE"
  exit 1
fi

KNOWN_COMMIT="$(git rev-parse HEAD)"
log "Starting run from commit $KNOWN_COMMIT"

MAX_RETRIES="$(python3 -c "import json;print(json.load(open('$CONFIG'))['max_retries_per_task'])")"
MAX_TASK_SECONDS="$(python3 -c "import json;print(json.load(open('$CONFIG'))['max_single_task_seconds'])")"

TASK_JSON="$(python3 "$REPO/automation/queue.py" pick)"
if [ "$TASK_JSON" = "null" ] || [ -z "$TASK_JSON" ]; then
  log "No eligible task (queue empty, all done, or next task's deps are blocked). Writing summary and stopping."
  python3 "$REPO/automation/queue.py" write-summary
  git add execution/OVERNIGHT_SUMMARY.md 2>/dev/null
  git commit -m "Overnight runner: final summary, queue exhausted

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" >> "$LOG_FILE" 2>&1 || true
  touch "$STOP_FILE"
  exit 0
fi

TASK_ID="$(echo "$TASK_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")"
PROMPT_FILE="$(echo "$TASK_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['prompt_file'])")"
TEST_CMD="$(echo "$TASK_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin).get('test_cmd',''))")"

log "Selected task: $TASK_ID"
python3 "$REPO/automation/queue.py" update-status "$TASK_ID" in_progress

PROMPT_PATH="$REPO/automation/tasks/$PROMPT_FILE"
if [ ! -f "$PROMPT_PATH" ]; then
  log "CRITICAL: prompt file missing: $PROMPT_PATH. Stopping runner."
  python3 "$REPO/automation/queue.py" update-status "$TASK_ID" pending
  touch "$STOP_FILE"
  exit 1
fi

RESULT_FILE="$LOG_DIR/${TASK_ID}-${TS}.json"
log "Running claude -p for task $TASK_ID (timeout ${MAX_TASK_SECONDS}s)"
run_with_timeout "$MAX_TASK_SECONDS" env -u ANTHROPIC_MODEL claude -p --model sonnet --output-format json "$(cat "$PROMPT_PATH")" > "$RESULT_FILE" 2>>"$LOG_FILE"
CLAUDE_EXIT=$?
log "claude -p exit code: $CLAUDE_EXIT"

if [ "$CLAUDE_EXIT" -ne 0 ]; then
  STATUS="$(python3 "$REPO/automation/queue.py" record-failure "$TASK_ID" "claude_exit_$CLAUDE_EXIT" "$MAX_RETRIES")"
  log "Task $TASK_ID recorded failure, new status: $STATUS"
  if [ "$STATUS" = "blocked" ]; then
    echo "- $TASK_ID blocked after $MAX_RETRIES failures (last: claude_exit_$CLAUDE_EXIT). See $LOG_FILE." >> "$REPO/execution/BLOCKERS.md"
  fi
  # claude -p itself failing (not a test failure) means no file changes to worry
  # about discarding; working tree should still be clean. Don't stop the whole
  # runner for one task's retry -- let the next fire try again (or the next
  # independent task, once dependency logic supports branching).
  exit 0
fi

if [ -n "$TEST_CMD" ]; then
  log "Running test command: $TEST_CMD"
  (eval "$TEST_CMD") >> "$LOG_FILE" 2>&1
  TEST_EXIT=$?
  log "Test exit code: $TEST_EXIT"
else
  TEST_EXIT=0
fi

if [ "$TEST_EXIT" -ne 0 ]; then
  STATUS="$(python3 "$REPO/automation/queue.py" record-failure "$TASK_ID" "test_exit_$TEST_EXIT" "$MAX_RETRIES")"
  log "Task $TASK_ID failed its tests, new status: $STATUS"
  if [ "$STATUS" = "blocked" ]; then
    echo "- $TASK_ID blocked after $MAX_RETRIES failures (last: test_exit_$TEST_EXIT). See $LOG_FILE." >> "$REPO/execution/BLOCKERS.md"
  fi
  log "Leaving the working tree exactly as the failed attempt left it (not discarding it -- it's evidence, and may contain salvageable work) and stopping the runner for manual review. The next run's clean-tree safety check will otherwise refuse to start anyway."
  touch "$STOP_FILE"
  exit 1
fi

git add -A
COMMIT_MSG="Overnight runner: $TASK_ID

$(python3 -c "
import json
try:
    d = json.load(open('$RESULT_FILE'))
    print((d.get('result','') or '')[:800])
except Exception as e:
    print(f'(could not parse result JSON: {e})')
")

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
COMMIT_EXIT=$?
if [ "$COMMIT_EXIT" -ne 0 ]; then
  log "CRITICAL: git commit failed (exit $COMMIT_EXIT) after a successful task. Stopping runner -- needs manual resolution, do not want to lose this verified work."
  touch "$STOP_FILE"
  exit 1
fi

python3 "$REPO/automation/queue.py" update-status "$TASK_ID" done
NEW_COMMIT="$(git rev-parse HEAD)"
log "Task $TASK_ID done. Committed $NEW_COMMIT"

# Keep execution/PROGRESS.md current for human resumability regardless of
# whether the runner keeps going.
{
  echo "# Progress"
  echo
  echo "Last updated by automation/overnight-runner.sh at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Most recent completed task: $TASK_ID"
  echo "Commit: $NEW_COMMIT"
  echo
  echo "## Next action"
  echo "Re-run automation/overnight-runner.sh, or check execution/TASK_QUEUE.json for remaining tasks."
} > "$REPO/execution/PROGRESS.md"
git add execution/PROGRESS.md
git commit -m "Update PROGRESS.md after $TASK_ID

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" >> "$LOG_FILE" 2>&1 || true

log "Run complete."
exit 0
