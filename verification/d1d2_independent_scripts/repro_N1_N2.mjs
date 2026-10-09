// N1: removal re-solves with allow_shed=true while "Allow load shedding" stays unchecked (order-dependent result).
// N2: slider shows confirmed (not pending) factor after re-selecting a line whose capacity solve is in flight.
import { open, selLine, removeBus, slider, settle, snap } from './lib.mjs'
const SS = process.env.BASE ? '/tmp' : '/Users/rishitmathurrishit/cascadia/verification/SCREENSHOTS'
{
  const { b, p } = await open(0)
  await selLine(p, 9); await p.getByRole('checkbox').focus(); await p.keyboard.press('Space'); await settle(p)
  await slider(p, 'ArrowLeft', 15); await settle(p)
  const a = await snap(p); console.log('N1 step1 line9 0.25x, shedding OFF ->', a.unserved, '|', a.provenance)
  await removeBus(p, 2); await settle(p)
  const b1 = await snap(p); console.log('N1 step2 + remove bus idx 2 ->', b1.unserved, '| checkbox checked =', b1.shedBox, '|', b1.provenance, '| last request:', b1.posts.at(-1))
  await p.screenshot({ path: `${SS}/indep-review-N1-shed-checkbox-off-but-shed-applied.png`, fullPage: true })
  await slider(p, 'ArrowRight'); await settle(p); await slider(p, 'ArrowLeft'); await settle(p)
  const c = await snap(p); console.log('N1 step3 same displayed scenario re-solved via slider ->', c.unserved, '|', c.provenance, '| last request:', c.posts.at(-1))
  await b.close()
}
{
  const { b, p } = await open(1500)
  await selLine(p, 9); await slider(p, 'ArrowLeft'); await p.waitForTimeout(350)
  await selLine(p, 10); await selLine(p, 9); await settle(p, 8000)
  const s = await snap(p); console.log('N2 slider shows', s.capFactor, '| line 9 applied rating', s.line9Rating, 'MW (0.95x = 30.40) | altered', s.altered)
  await p.screenshot({ path: `${SS}/indep-review-N2-slider-stale-after-reselect.png`, fullPage: true })
  await slider(p, 'ArrowRight'); await settle(p)
  const t = await snap(p); console.log('N2 then user presses ArrowRight (intending 1.00 -> 1.05):', t.capFactor, 'applied', t.line9Rating, 'MW', '| last request:', t.posts.at(-1))
  await b.close()
}
