import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

// Shared GSAP lifecycle layer, phase 2 of the cinematic-motion directive. Plugin registration belongs
// in exactly ONE place, at module load (ES module caching makes this idempotent regardless of how many
// files import this module) -- never per-component, which would re-register the plugin on every mount.
// DrawSVGPlugin: used for the intro's "lines draw outward" beat (ART_DIRECTION.md section 4's
// storyboard) -- confirmed included and free in the installed gsap version (CLAUDE.md's note: every
// GSAP plugin became free under the Webflow "Standard No-Charge" license since the Labor Day 2025
// acquisition; this was historically a Club GreenSock-only plugin, so its availability was verified by
// checking node_modules directly before using it, not assumed).
gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin)

export { gsap, ScrollTrigger }
