import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    // GitHub Pages deploys to /<repo-name>/
    base: '/claude-mobile-companion/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'Claude Mobile Companion',
                short_name: 'ClaudeMobile',
                description: 'Control Claude Code from your phone',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                ],
            },
        }),
    ],
    server: {
        port: 5199,
    },
});
