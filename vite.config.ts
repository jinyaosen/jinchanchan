import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 使用相对路径构建，方便直接打开 dist 或部署到任意子目录。
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: {
    format: 'es',
  },
});
