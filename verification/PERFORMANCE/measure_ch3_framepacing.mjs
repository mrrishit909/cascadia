// ART_DIRECTION.md section 4's kill criterion, applied to chapter 3's corridor-strip morph (the
// user's own explicit priority: "Chapter 3 is a performance-critical case... measure the actual
// frame-pacing impact of SVG geometry updates, transforms, and glow filters"). Against the REAL
// production build (never a dev server), glow ON (never disabled for the measurement), scrolling
// continuously through the scrub range while sampling requestAnimationFrame deltas in-page.
//
// Kill criteria (ART_DIRECTION.md section 4): p95 frame time > 33.3ms on a throttled/mobile profile,
// or > 16.7ms at 1440x900 desktop, triggers the fallback escalation ladder (fade glow during
// transforms -> move bloom to a Canvas 2D underlay -> WebGL only as a last resort).
import { chromium } from '@playwright/test';

async function measure(label, { throttle, viewport }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
  const client = await page.context().newCDPSession(page);
  if (throttle) await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto('http://localhost:4173/');
  await page.locator('#ch3').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch3');
  await page.waitForTimeout(700); // settle the instant inset-shrink transition before measuring the scrub itself

  // Entirely in-page: an earlier version drove this scroll from Node, one `page.evaluate` round-trip
  // per step -- that IPC overhead itself showed up as rAF jitter indistinguishable from real app cost
  // (every profile, even 4x-throttled, converged on an identical ~16.7ms median, which is just vsync
  // cadence, not a real measurement). Driving the whole scroll+sample loop from a single in-page
  // rAF-chained script removes that confound: the ONLY thing between one rAF and the next is real
  // browser work (style/layout/paint, Chapter3Scene's own getScreenCTM re-measurement, the glow tween).
  const deltas = await page.evaluate(() => new Promise(resolve => {
    const el = document.getElementById('ch3');
    const top = el.offsetTop, span = el.offsetHeight * 0.4; // Chapter3Scene.tsx's own end:'40% top'
    const totalFrames = 180; // ~3s at 60fps
    const out = [];
    let last = performance.now();
    let frame = 0;
    function tick() {
      const now = performance.now();
      out.push(now - last);
      last = now;
      frame++;
      if (frame > totalFrames) { resolve(out); return; }
      window.scrollTo(0, top + span * (frame / totalFrames));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
  // Drop the first few samples (warm-up: initial scrollTo/layout settling, not steady-state cost).
  deltas.splice(0, 5);
  await browser.close();

  const sorted = [...deltas].sort((a, b) => a - b);
  const pct = p => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const result = {
    label, viewport, throttle: throttle ?? 1, sampleCount: deltas.length,
    p50Ms: +pct(50).toFixed(2), p95Ms: +pct(95).toFixed(2), maxMs: +Math.max(...deltas).toFixed(2),
    killCriterionMs: throttle && throttle > 1 ? 33.3 : 16.7,
  };
  result.pass = result.p95Ms <= result.killCriterionMs;
  return result;
}

const results = [];
results.push(await measure('desktop-1440x900', { viewport: { width: 1440, height: 900 } }));
results.push(await measure('desktop-1440x900-4x-throttled', { viewport: { width: 1440, height: 900 }, throttle: 4 }));
results.push(await measure('mobile-390x844-4x-throttled', { viewport: { width: 390, height: 844 }, throttle: 4 }));

console.log(JSON.stringify(results, null, 2));
const allPass = results.every(r => r.pass);
console.log(allPass ? '\nALL PROFILES PASS the kill criteria.' : '\nAT LEAST ONE PROFILE FAILS the kill criteria -- apply the escalation ladder.');
process.exit(allPass ? 0 : 1);
