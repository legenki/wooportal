import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/options',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { options: resolve(__dirname, 'src/options/index.html') },
      output: { entryFileNames: '[name].js', assetFileNames: '[name].[ext]' },
    },
  },
});
