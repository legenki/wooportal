import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/popup',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'src/popup/index.html') },
      output: { entryFileNames: '[name].js', assetFileNames: '[name].[ext]' },
    },
  },
});
