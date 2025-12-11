import * as esbuild from 'esbuild';

// Build content script as IIFE (no ES modules)
await esbuild.build({
  entryPoints: ['content_script.ts'],
  bundle: true,
  outfile: 'dist/content_script.js',
  format: 'iife',
  target: 'chrome100',
  minify: true,
});

console.log('Content script built successfully!');
