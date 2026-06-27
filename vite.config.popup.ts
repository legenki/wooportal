import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'src/popup/index.html') },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: (info) => info.name === 'index.css' ? 'popup.css' : '[name].[ext]',
        // Keep the HTML flat in dist (not nested under src/popup/)
      },
    },
  },
  plugins: [
    {
      name: 'flatten-popup-html',
      closeBundle() {
        // Move dist/src/popup/index.html → dist/popup.html
        try {
          copyFileSync(
            resolve(__dirname, 'dist/src/popup/index.html'),
            resolve(__dirname, 'dist/popup.html'),
          );
        } catch {
          // Already at dist/popup.html (rerun), ignore
        }
      },
    },
    {
      name: 'copy-public-assets',
      closeBundle() {
        // Copy manifest, icons and land-110m.json into dist
        try {
          copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
        } catch { /* */ }
      },
    },
  ],
});
