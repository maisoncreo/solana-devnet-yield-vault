import { defineConfig } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export default defineConfig({
  resolve: {
    // Resolve the browser Buffer polyfill from frontend even for linked vendor code.
    alias: { buffer: require.resolve('buffer/') },
  },
});
