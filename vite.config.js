import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Repo adınızı buraya yazın
const repoName = 'design-app'; 

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  return {
    plugins: [svelte()],
    // Sadece build işlemi sırasında base path'i ayarla
    base: isProduction ? `/${repoName}/` : '/', 
  }
})