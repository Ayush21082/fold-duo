import { defineConfig } from 'vite';

export default defineConfig({
  // three.js is one large module; it is the bulk of the bundle by design.
  build: { chunkSizeWarningLimit: 800 },
});
