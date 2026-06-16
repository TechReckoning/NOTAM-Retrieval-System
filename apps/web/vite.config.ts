import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// On GitHub Pages the app is served from /<repo>/, so production assets need that
// base path. `VITE_BASE` lets you override it (e.g. '/' for a custom domain or a
// different host). Dev always uses '/'.
const PROD_BASE = process.env.VITE_BASE ?? '/NOTAM-Retrieval-System/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PROD_BASE : '/',
  plugins: [react()],
  server: {
    port: 5180,
    // Allow importing the demo JSON snapshot from the repo's data/ directory.
    fs: { allow: ['../..'] },
  },
}));
