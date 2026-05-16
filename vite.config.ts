import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      // Alias que comparte el mismo módulo singleton del bridge del SDK de Power Apps.
      // Garantiza que dataverseSdk.ts y el SDK interno usen el mismo bridgePromise.
      '@pa-bridge': path.resolve(
        './node_modules/@microsoft/power-apps/dist/internal/plugins/PluginBridge.js',
      ),
    },
  },
});
