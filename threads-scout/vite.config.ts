import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'manifest.json',
      additionalInputs: [
        'src/offscreen/offscreen.html',
        'src/options/index.html',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
