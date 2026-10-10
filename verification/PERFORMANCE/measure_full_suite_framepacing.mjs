// Full-experience production frame-pacing measurement (ART_DIRECTION.md section 4's kill criterion,
// applied across the WHOLE intro+6-chapter journey, not a substitute for chapter 3's own earlier
// isolated measurement -- verification/PERFORMANCE/CH3_FRAMEPACING_REPORT.md stays as evidence for
// that chapter alone; this is the broader, integrated pass the directive asks for). Against the real
// production build only (npm run build && npm run preview), glow on throughout, never disabled for
// the measurement. Every scenario is driven by an in-page requestAnimationFrame loop (not per-step
// Node<->browser round trips) -- the chapter 3 report found that round-trip IPC overhead itself reads
// as jitter indistinguishable from real app cost.
import { chromium } from '@playwright/test';

const KILL = { desktop: 16.7, throttled: 33.3 };

async function sampleInPage(page, driver, frames = 180) {
  // `driver` is a plain, self-contained (frame, frames) => void function (no closure over outer
  // scope) -- its source text is evaluated INSIDE the page context via `eval`, not passed as a data
  // argument (Playwright's evaluate() only accepts JSON-serializable args, not live functions).
  return page.evaluate(({ driverSrc, frames }) => new Promise(resolve => {
    // eslint-disable-next-line no-eval
    const driverFn = (0, eval)(driverSrc);
    const out = [];
    let last = performance.now();
    let frame = 0;
    function tick() {
      const now = performance.now();
      out.push(now - last);
      last = now;
      frame++;
      if (frame > frames) { resolve(out); return; }
      driverFn(frame, frames);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), { driverSrc: driver.toString(), frames });
}

function stats(deltas, warmup = 5) {
  const d = deltas.slice(warmup);
  const sorted = [...d].sort((a, b) => a - b);
  const pct = p => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return { sampleCount: d.length, p50Ms: +pct(50).toFixed(2), p95Ms: +pct(95).toFixed(2), maxMs: +Math.max(...d).toFixed(2) };
}

async function run(label, { viewport, throttle, reducedMotion = 'no-preference', setup, driver, frames = 180 }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, reducedMotion });
  const client = await page.context().newCDPSession(page);
  if (throttle) await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(500);
  if (setup) await setup(page);
  await page.waitForTimeout(300);
  const deltas = await sampleInPage(page, driver, frames);
  await browser.close();
  const s = stats(deltas);
  const killMs = throttle && throttle > 1 ? KILL.throttled : KILL.desktop;
  return { label, viewport: `${viewport.width}x${viewport.height}`, throttle: throttle ?? 1, ...s, killCriterionMs: killMs, pass: s.p95Ms <= killMs };
}

// Drivers run IN-PAGE (stringified, no closures over outer scope) -- plain functions of (frame, frames).
const drivers = {
  idle: () => {},
  forwardScroll: (frame, frames) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, (frame / frames) * max);
  },
  reverseScroll: (frame, frames) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max - (frame / frames) * max);
  },
  rapidNav: (frame) => {
    const ids = ['intro', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'];
    if (frame % 25 === 0) {
      const el = document.getElementById(ids[(frame / 25) % ids.length]);
      if (el) window.scrollTo(0, el.offsetTop);
    }
  },
  ch3Morph: (frame, frames) => {
    const el = document.getElementById('ch3');
    if (!el) return;
    window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.4 * (frame / frames));
  },
};

const results = [];
const dir = '/Users/rishitmathurrishit/cascadia';

// 1. Idle baseline (desktop) -- the control every other number is judged against.
results.push(await run('idle-baseline-desktop', { viewport: { width: 1440, height: 900 }, driver: drivers.idle }));

// 2. Forward scroll, full journey, desktop.
results.push(await run('forward-scroll-full-journey-desktop', { viewport: { width: 1440, height: 900 }, driver: drivers.forwardScroll, frames: 240 }));

// 3. Reverse scroll, full journey, desktop.
results.push(await run('reverse-scroll-full-journey-desktop', {
  viewport: { width: 1440, height: 900 },
  setup: async page => { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); },
  driver: drivers.reverseScroll, frames: 240,
}));

// 4. Rapid navigation (FIG index-style jumps), desktop.
results.push(await run('rapid-navigation-desktop', { viewport: { width: 1440, height: 900 }, driver: drivers.rapidNav, frames: 180 }));

// 5. Chapter 3 corridor morph, integrated (full page loaded, not isolated), desktop + mobile throttled.
results.push(await run('ch3-corridor-morph-integrated-desktop', {
  viewport: { width: 1440, height: 900 },
  setup: async page => {
    await page.locator('#ch3').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch3');
    await page.waitForTimeout(700);
  },
  driver: drivers.ch3Morph, frames: 180,
}));
results.push(await run('ch3-corridor-morph-integrated-mobile-4x', {
  viewport: { width: 390, height: 844 }, throttle: 4,
  setup: async page => {
    await page.locator('#ch3').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch3');
    await page.waitForTimeout(700);
  },
  driver: drivers.ch3Morph, frames: 180,
}));

// 6. Chapter 4 single-shot fracture tween, desktop + mobile throttled (re-triggered via a fresh
// control confirm so the 700ms tween is genuinely captured mid-flight by the sampler).
async function ch4Setup(page) {
  await page.locator('#ch4').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch4');
  await page.waitForTimeout(400);
  await page.locator('[data-testid="bus"][data-bus="5"]').focus();
  await page.keyboard.press('Enter');
  const btn = page.locator('[data-placement="home"]').filter({ hasText: 'Remove substation' }).getByRole('button', { name: 'Confirm removal' });
  await btn.focus();
  await page.keyboard.press('Enter'); // fires the 700ms tween; sampler starts immediately after
}
results.push(await run('ch4-fracture-tween-desktop', { viewport: { width: 1440, height: 900 }, setup: ch4Setup, driver: drivers.idle, frames: 60 }));
results.push(await run('ch4-fracture-tween-mobile-4x', { viewport: { width: 390, height: 844 }, throttle: 4, setup: ch4Setup, driver: drivers.idle, frames: 60 }));

// 7. Chapter 6 solving feedback (dim-while-solving), with a real artificial WASM delay so the sampler
// reliably captures the dimmed/transitioning state, desktop + mobile throttled.
async function ch6Setup(page) {
  await page.route('**/*.wasm', async route => { await new Promise(r => setTimeout(r, 1200)); await route.continue(); });
  await page.locator('#ch6').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch6');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="bus"][data-bus="6"]').focus();
  await page.keyboard.press('Enter');
  const btn = page.locator('[data-placement="lab"]').filter({ hasText: 'Remove substation' }).getByRole('button', { name: 'Confirm removal' });
  await btn.focus();
  await page.keyboard.press('Enter'); // solve now in flight for ~1200ms; sampler runs through it
}
results.push(await run('ch6-solving-feedback-desktop', { viewport: { width: 1440, height: 900 }, setup: ch6Setup, driver: drivers.idle, frames: 72 }));
results.push(await run('ch6-solving-feedback-mobile-4x', { viewport: { width: 390, height: 844 }, throttle: 4, setup: ch6Setup, driver: drivers.idle, frames: 72 }));

// 8. Live solver update DURING motion: trigger a real solve while ALSO scrolling (chapter 4, the
// combined worst case -- geometry tween + Worker solve + React re-render all at once).
async function liveDuringMotionSetup(page) {
  await page.route('**/*.wasm', async route => { await new Promise(r => setTimeout(r, 800)); await route.continue(); });
  await page.locator('#ch4').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.stage-sticky')?.getAttribute('data-active-chapter') === 'ch4');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="bus"][data-bus="7"]').focus();
  await page.keyboard.press('Enter');
  const btn = page.locator('[data-placement="home"]').filter({ hasText: 'Remove substation' }).getByRole('button', { name: 'Confirm removal' });
  await btn.focus();
  await page.keyboard.press('Enter'); // solve in flight; sampler's own driver below scrolls at the same time
}
results.push(await run('live-solver-during-ch4-motion-desktop', {
  viewport: { width: 1440, height: 900 }, setup: liveDuringMotionSetup,
  driver: (frame, frames) => { const el = document.getElementById('ch4'); if (el) window.scrollTo(0, el.offsetTop + (frame / frames) * 200); },
  frames: 60,
}));

const allPass = results.every(r => r.pass);
const report = { generatedAt: new Date().toISOString(), buildType: 'production (npm run build && npm run preview)', results, allPass };
console.log(JSON.stringify(report, null, 2));
process.exit(allPass ? 0 : 1);
