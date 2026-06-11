// Kagaz docs site (Starlight). The full documentation set still lives in
// the repo's /docs markdown tree; migrating it into this site is tracked
// in DEVELOPMENT-CHECKLIST.md SS Doc Gaps. Until then the site is a minimal
// shell with an auto-generated sidebar so `pnpm build` stays green.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://kagaz-docs.example.com',
  integrations: [
    starlight({
      title: 'Kagaz Documentation',
      description: 'Privacy-first document management for India',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/omanandswami2005/omni-Docs-and-CSC',
        },
      ],
      editLink: {
        baseUrl:
          'https://github.com/omanandswami2005/omni-Docs-and-CSC/edit/main/',
      },
    }),
  ],
});
