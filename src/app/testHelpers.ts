// Chapter shell: controls now live inside their own chapter <section>s (App.tsx), not a single
// "home-controls" wrapper div -- that wrapper existed only for the dual-placement gate proof's LabStub
// phase and disappeared once controls split across real chapters. Mirrors e2e's controlHome(page,
// label) (e2e/helpers/placement.ts): find the one `[data-placement="home"]` control section whose text
// content matches `label`, then scope RTL queries to it with `within(homeControl(label))`.
export function homeControl(label: string): HTMLElement {
  const sections = Array.from(document.querySelectorAll('[data-placement="home"]')) as HTMLElement[]
  const match = sections.find(el => el.textContent?.includes(label))
  if (!match) throw new Error(`No home-placement control section found containing text "${label}". Found: ${sections.map(s => s.textContent?.slice(0, 40)).join(' | ')}`)
  return match
}
