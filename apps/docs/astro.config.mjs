import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://kagaz-docs.example.com',
  integrations: [
    starlight({
      title: 'Kagaz Documentation',
      description: 'Privacy-first document management for India',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'Kagaz Logo',
      },
      social: {
        github: 'https://github.com/omanandswami2005/omni-Docs-and-CSC',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Installation', slug: 'getting-started/installation' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            {
              label: 'Overview',
              slug: 'architecture/overview',
            },
            {
              label: 'Layered Architecture',
              slug: 'architecture/layers',
            },
            {
              label: 'Module Structure',
              slug: 'architecture/modules',
            },
            {
              label: 'Protocol Design',
              slug: 'architecture/protocols',
            },
            {
              label: 'V1 Modules',
              items: [
                {
                  label: 'Document Vault',
                  slug: 'architecture/v1-document-vault',
                },
                {
                  label: 'PDF Engine',
                  slug: 'architecture/v1-pdf-engine',
                },
                {
                  label: 'Image Engine',
                  slug: 'architecture/v1-image-engine',
                },
                {
                  label: 'AI Assistant',
                  slug: 'architecture/v1-ai-assistant',
                },
              ],
            },
            {
              label: 'V2 Modules',
              items: [
                {
                  label: 'Document Sharing',
                  slug: 'architecture/v2-sharing',
                },
                {
                  label: 'Cloud Sync',
                  slug: 'architecture/v2-cloud-sync',
                },
              ],
            },
          ],
        },
        {
          label: 'API Reference',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Development Guide',
          items: [
            { label: 'Setup', slug: 'development/setup' },
            { label: 'Development Workflow', slug: 'development/workflow' },
            { label: 'Testing', slug: 'development/testing' },
            { label: 'Code Style', slug: 'development/code-style' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Contributing Guide', slug: 'contributing/guide' },
            { label: 'Agent Rules', slug: 'contributing/agent-rules' },
            { label: 'Git Workflow', slug: 'contributing/git-workflow' },
            { label: 'Commit Convention', slug: 'contributing/commits' },
            { label: 'Parallel Development', slug: 'contributing/parallel' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Protocol Design Pattern', slug: 'guides/protocol-design' },
            { label: 'Module Creation', slug: 'guides/module-creation' },
            { label: 'Performance Optimization', slug: 'guides/performance' },
            { label: 'Security Best Practices', slug: 'guides/security' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      editLink: {
        baseUrl:
          'https://github.com/omanandswami2005/omni-Docs-and-CSC/edit/main/docs/',
      },
      head: [
        {
          tag: 'meta',
          attrs: {
            name: 'description',
            content:
              'Kagaz - Privacy-first document management app for India. Offline-first, no tracking, encrypted.',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'robots',
            content: 'index, follow',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'og:title',
            content: 'Kagaz - Document Management',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'og:description',
            content:
              'Privacy-first document management app with PDF operations, AI assistant, and government service integration.',
          },
        },
      ],
    }),
  ],
});
