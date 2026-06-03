import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import path from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@xyflow/react': path.resolve(__dirname, './src/utils/xyflow-mock.tsx'),
      },
    },
    server: {
      fs: {
        allow: ['../../packages', '../../apps']
      }
    }
  }),
  manifest: {
    name: 'Flowscript',
    description: 'Configurable browser automation engine.',
    permissions: ['sidePanel', 'storage', 'tabs', 'debugger', 'unlimitedStorage']
  }
});

