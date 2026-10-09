#!/bin/bash
# Stop the overnight runner: unload the launchd job and write the STOP
# sentinel (belt-and-suspenders -- if unload fails for some reason, the
# sentinel still stops the next fire from doing anything).
set -uo pipefail
REPO="$HOME/cascadia"
PLIST_NAME="com.cascadia.overnight-runner"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

touch "$REPO/automation/STOP"
echo "Wrote STOP sentinel: $REPO/automation/STOP"

if launchctl print "gui/$(id -u)/$PLIST_NAME" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$PLIST_NAME"
  echo "Unloaded launchd job $PLIST_NAME"
else
  echo "launchd job $PLIST_NAME was not loaded (already stopped, or never started)"
fi

echo
echo "To fully remove: rm '$PLIST_DEST'"
echo "To resume later: rm '$REPO/automation/STOP' && launchctl bootstrap gui/$(id -u) '$PLIST_DEST'"
