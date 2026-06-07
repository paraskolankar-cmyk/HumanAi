import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // Aapke backend ka URL (Agar local chal raha hai to http://localhost:5000 ho sakta hai)
  // Hum ise env.APP_URL se bhi le sakte hain agar wahan backend ka URL daala hai to
  const BACKEND_URL = env.APP_URL || 'http://localhost:5000'; 

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.APP_URL': JSON.stringify(env.APP_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      
      // 👇 YEH PROXY SECTION ADD KIYA HAI 👇
      proxy: {
        '/api': {
          target: BACKEND_URL, // Backend server ka address
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      // 1. Chunk size limit ko 1000kB tak badha diya
      chunkSizeWarningLimit: 1000,
      
      // 2. Chunks ko optimize karne ke liye (Optional but recommended)
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
