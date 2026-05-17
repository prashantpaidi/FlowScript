import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeBlack from 'starlight-theme-black';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Flowscript',
      description: 'Visual browser automation docs for Flowscript.',
      logo: {
        src: './src/assets/logo.svg',
      },
      plugins: [
        starlightThemeBlack({
          navLinks: [
            {
              label: 'Docs',
              link: '/foundations/introduction/',
            },
          ],
          footerText:
            'Built with [Starlight](https://starlight.astro.build/) and [starlight-theme-black](https://github.com/adrian-ub/starlight-theme-black).',
        }),
      ],
      sidebar: [
        {
          label: 'Foundations',
          items: [
            { label: 'Introduction', slug: 'foundations/introduction' },
            { label: 'Installation Guide', slug: 'foundations/installation' },
            { label: 'Your First Automation', slug: 'foundations/first-automation' },
            { label: 'UI Walkthrough', slug: 'foundations/ui-walkthrough' },
          ],
        },
      ],
    }),
  ],
});
