import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    createVuePlugin(),
    monacoEditorPlugin({ languageWorkers: ['editorWorkerService', 'json'] }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@qii404/vue-easy-tree': path.resolve(__dirname, 'src/vendor/vue-easy-tree/index.js'),
      'vue': path.resolve(__dirname, 'node_modules/vue/dist/vue.esm.js'),
    },
    extensions: ['.js', '.vue', '.json'],
  },

  server: {
    port: 19988,
    strictPort: true,
    hmr: {
      port: 19989,
    },
    proxy: {
      '/api': 'http://localhost:9988',
      '/ws': { target: 'ws://localhost:9988', ws: true },
    },
  },

  optimizeDeps: {
    include: ['buffer'],
    exclude: ['monaco-editor'],
  },

  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      plugins: [],
    },
  },

});
