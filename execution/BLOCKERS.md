# Blockers

None currently.
- Minor cosmetic bug in cas_int_001_control: the debug/status line reads "bus 1 removed" while the main result correctly shows "Bus 2 unavailable" for the same action (off-by-one or stale-label issue in the Worker-call debug text, not the actual computed result). Confirmed via verification/SCREENSHOTS/cas-int-001-keyboard-remove.png. Low priority, doesn't affect correctness of the displayed MW value. Track for a later cleanup pass.
