---
name: motion-timeline-dev
description: Build one chapter's GSAP/ScrollTrigger choreography (entry, exit, reverse, reduced-motion fallback) for one Atlas project. Use once per chapter, owned by motion-engineer.
---

# Motion Timeline Development

**When:** During M4, one invocation per chapter (6 per project) plus one for the opening storyboard.
**Input:** the chapter's assigned composition archetype (from creative-direction), `docs/extracted/MOTION_REQUIREMENTS.md`'s technique menu.

## Procedure

1. Pick techniques deliberately from the menu (masked text reveal, parallax, 3D tilt, magnetic CTA, horizontal passage, scroll-bound chart morph, camera transition, loading feedback) — only what this chapter's content actually needs.
2. Build the GSAP timeline with explicit trigger, keyframes, easing, and a reverse path that is state-safe (scrolling back up must not corrupt application state).
3. Write the `prefers-reduced-motion` branch: instant state changes, analysis content still fully present, no parallax/spinning.
4. Test interruption safety: trigger the animation, then immediately change the underlying data/trigger a reset mid-timeline — the timeline must cancel cleanly, not desync.
5. Record frame timing on the stated test device for this chapter specifically (not just the overall page).

**Output:** one chapter's working timeline + reduced-motion fallback + an interruption test.
**Failure condition:** a timeline that corrupts state on reverse-scroll, or a reduced-motion path that hides required analytical content instead of just skipping decoration.
**Recovery:** On a desync found during the interruption test, cancel-and-restore logic in the timeline itself needs fixing, not a workaround in the triggering component; re-test the specific interruption sequence that failed, not just a fresh run.
