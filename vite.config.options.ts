import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { options: resolve(__dirname, 'src/options/index.html') },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'flatten-options-html',
      closeBundle() {
        try {
          copyFileSync(
            resolve(__dirname, 'dist/src/options/index.html'),
            resolve(__dirname, 'dist/options.html'),
          );
        } catch {
          // Already at dist/options.html, ignore
        }
      },
    },
  ],
});
