import { defineConfig, type Plugin } from 'vite';

// O Wallpaper Engine abre o index.html direto do disco (file://), onde o
// navegador recusa <script type="module">. O bundle sai como IIFE num script
// clássico com defer.
function classicScript(): Plugin {
  return {
    name: 'classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/<script type="module" crossorigin/g, '<script defer');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [classicScript()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
