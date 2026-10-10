import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

// Lighthouse's own render-blocking-insight audit (verification/PERFORMANCE/LIGHTHOUSE_REPORT.md)
// flagged the single ~4KB CSS bundle as render-blocking, estimating ~750ms of LCP/FCP savings if
// removed from the critical path -- more than enough to explain the measured mobile LCP miss (2.567s
// against a 2.5s gate). The whole app ships one small CSS file (cssCodeSplit isn't in play here), so
// inlining it directly into index.html at build time removes the extra request+render-block entirely,
// rather than reaching for a heavier critical-CSS-extraction dependency for a single 4KB file.
function inlineCss(): Plugin {
  let cssContent = ''
  return {
    name: 'inline-css',
    generateBundle(_, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && asset.type === 'asset') {
          cssContent += typeof asset.source === 'string' ? asset.source : asset.source.toString()
          delete bundle[fileName]
        }
      }
    },
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="stylesheet"[^>]*>/g, '')
        .replace('</head>', `<style>${cssContent}</style></head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), inlineCss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // vitest's default glob also matches Playwright's e2e/*.spec.ts, which
    // errors because those files call test() outside Playwright's runner.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.test.ts'],
  },
})
