import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // El paquete compartido se resuelve a su fuente, no a su `dist`: así el
      // build de la web (Vercel compila solo esta app) no depende de que nadie
      // haya ejecutado antes el `tsc` de packages/shared.
      '@quedamos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
