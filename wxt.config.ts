import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Flowscript',
    description: 'Configurable browser automation engine.',
    permissions: ['sidePanel', 'storage', 'tabs', 'debugger']
  }
});
