import { defineConfig } from '@playwright/test'
// Scratch config (reviewer). BASE=http://localhost:4173 (current HEAD build) or :4174 (pre-fix ab5901c~1 build).
export default defineConfig({ testDir: '.', workers: 2, use: { baseURL: process.env.BASE ?? 'http://localhost:4173' } })
