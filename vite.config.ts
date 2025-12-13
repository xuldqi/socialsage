import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin to copy manifest.json, icons, and CSS to dist
const copyManifestPlugin = () => ({
  name: 'copy-manifest',
  closeBundle() {
    // Ensure dist exists
    if (!existsSync('dist')) {
      mkdirSync('dist', { recursive: true });
    }
    // Copy manifest.json
    copyFileSync('manifest.json', 'dist/manifest.json');
    // Copy icons from root directory
    ['16', '48', '128'].forEach(size => {
      const iconPath = `icon${size}.png`;
      if (existsSync(iconPath)) {
        copyFileSync(iconPath, `dist/icon${size}.png`);
      }
    });
    // Copy content script CSS
    if (existsSync('content_style.css')) {
      copyFileSync('content_style.css', 'dist/content_style.css');
    }
  }
});

// Plugin to build content script separately as IIFE
const buildContentScriptPlugin = () => ({
  name: 'build-content-script',
  async closeBundle() {
    await build({
      configFile: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'content_script.ts'),
          name: 'ContentScript',
          formats: ['iife'],
          fileName: () => 'content_script.js'
        },
        outDir: 'dist',
        minify: 'terser',
        terserOptions: {
          compress: { drop_console: false, drop_debugger: true },
          format: { comments: false }
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true
          }
        }
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyManifestPlugin(), buildContentScriptPlugin()],
  build: {
    // Enable minification and obfuscation
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
      format: {
        comments: false, // Remove comments
      },
    },
    rollupOptions: {
      input: {
        // Entry 1: The React App (Side Panel)
        main: resolve(__dirname, 'index.html'),
        // Entry 2: The Service Worker
        background: resolve(__dirname, 'background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash].[ext]',
      },
    },
  },
});