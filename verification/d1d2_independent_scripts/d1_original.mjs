// Original D1 repro, both directions, several delays, solver-derived assertions.
// usage: node d1_original.mjs   (needs `npx vite preview --port 4173` on a fresh `npm run build`)
import { open, selBus, selLine, removeBus, slider, settle, snap } from './lib.mjs'
const R9 = 32 // line 9 rating MW (public/data/raw-metadata/case30.json)
let fails = 0
for (const delay of [0, 300, 1500, 4000]) {
  for (const dir of ['remove-then-cap', 'cap-then-remove', 'cap-wait300-then-remove']) {
    const { b, p } = await open(delay)
    await selLine(p, 9)
    if (dir === 'remove-then-cap') { await removeBus(p, 26); await slider(p, 'ArrowLeft') }
    else if (dir === 'cap-then-remove') { await slider(p, 'ArrowLeft'); await removeBus(p, 26) }
    else {
      await slider(p, 'ArrowLeft'); await p.waitForTimeout(300) // debounce elapsed -> capacity solve in flight
      await p.locator('[data-bus="26"]').focus(); await p.keyboard.press('Enter')
      const dis2 = await p.getByRole('button', { name: 'Confirm removal' }).isDisabled()
      console.log(`  [${dir} d=${delay}] confirm disabled during capacity solve: ${dis2}`)
      if (dis2) { await settle(p); const gone = await p.getByRole('button', { name: 'Confirm removal' }).count() === 0
        console.log(`  [${dir} d=${delay}] bus selection made during solve was cleared when solve landed: ${gone}`)
        if (gone) await selBus(p, 26) }
      await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter')
    }
    await settle(p, 8000)
    const s = await snap(p)
    const ok = s.bus26 === 'removed' && s.bus28 === 'shed_no_generation' && Math.abs(s.line9Rating - 0.95 * R9) < 0.006 && s.unserved === '13.00 MW' && s.capFactor === '0.95x'
    if (!ok) fails++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${dir} delay=${delay}:`, JSON.stringify({ bus26: s.bus26, bus28: s.bus28, line9Rating: s.line9Rating, unserved: s.unserved, capFactor: s.capFactor, prov: s.provenance, posts: s.posts }))
    await b.close()
  }
}
console.log('fails', fails)
