---
name: 3d-asset-integration
description: Integrate a Three.js/React Three Fiber scene (geometry, materials, lighting, camera) only where the dossier's visual metaphor is genuinely spatial. Use when a project's flagship interaction or a chapter explicitly calls for 3D, owned by motion-engineer.
---

# 3D Asset Integration

**When:** During M4, only for scenes where 2D/Canvas genuinely cannot represent the analytical structure (per `docs/extracted/MOTION_REQUIREMENTS.md`'s library matrix: "3D scenes -> Three.js/R3F/Drei -> audit device fallback, model size, texture rights, memory").

## Procedure

1. Justify the 3D use first: what analytical state does camera/geometry/material actually represent? If the answer is "it looks cool," use Canvas/SVG instead.
2. Check every asset's license and file size before import. Record attribution.
3. Build with instancing/LOD for anything beyond ~100 objects; cap device pixel ratio; render only on change (no continuous idle render loop).
4. Build the Canvas/SVG or static-diagram fallback for WebGL-unavailable and low-end mobile, covering the same analytical content.
5. Measure actual memory and frame timing before committing to the final geometry/particle budget.

**Output:** the 3D scene + its non-WebGL fallback + a measured perf budget.
**Failure condition:** 3D content with no analytical meaning, or no fallback for WebGL context loss/unavailability.
**Recovery:** If WebGL perf/budget can't be hit after one optimization pass (instancing, LOD, DPR cap), drop to the Canvas/SVG fallback as the primary scene, not just the mobile path, and tell the Orchestrator the 3D attempt is deferred -- don't ship a stuttering scene to hit a 3D checkbox.
