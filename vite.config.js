import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Repo adını burada tutmaya gerek kalmadı (base için)
// const repoName = 'design-app'; 

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // command değişkenini kullanmaya gerek kalmadı (şimdilik)
  // const isProduction = command === 'build'; 
  return {
    plugins: [svelte()],
    // Base path her zaman '/' olmalı (Cloudflare Pages root deploy için)
    base: '/', 
  }
})