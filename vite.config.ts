import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub project Pages serves the app below /Alcemy-Sim1/.
  base: process.env.VITE_BASE_PATH ?? '/',
});
