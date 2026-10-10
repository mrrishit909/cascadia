import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Shared GSAP lifecycle layer, phase 2 of the cinematic-motion directive. Plugin registration belongs
// in exactly ONE place, at module load (ES module caching makes this idempotent regardless of how many
// files import this module) -- never per-component, which would re-register the plugin on every mount.
gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }
