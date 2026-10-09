import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

afterEach(() => vi.unstubAllGlobals())

it('renders 30 buses and 41 lines from the baseline fixture', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const mod = await files[`/public${url.slice(url.indexOf('/data/'))}`]()
    return { ok: true, json: async () => mod }
  })
  render(<App />)
  expect(await screen.findAllByTestId('bus')).toHaveLength(30)
  expect(screen.getAllByTestId('line')).toHaveLength(41)
})
