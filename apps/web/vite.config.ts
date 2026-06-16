import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // Allow importing the demo JSON snapshot from the repo's data/ directory.
    fs: { allow: ['../..'] },
  },
});
