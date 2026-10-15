// Build Android : tout le jeu (JS + CSS) est intégré dans un unique index.html,
// chargé par le WebView depuis file:///android_asset/ (les modules externes y seraient bloqués).
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-android', target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false },
});
