import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    define: {
      __RELEASE_REPOSITORY__: JSON.stringify(
        process.env.STUDIO_RELEASE_REPOSITORY || 'pierrelmy/mardown-studio',
      ),
    },
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve('electron/main.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('electron/preload.ts'),
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'development-csp',
        apply: 'serve',
        transformIndexHtml(html) {
          return html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
        },
      },
    ],
    build: {
      assetsInlineLimit: 1000000,
      reportCompressedSize: false,
      rollupOptions: { input: resolve('index.html') },
    },
  },
})
