import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SPARTA Building',
        short_name: 'Building',
        description: 'System for Property Administration, Reporting, Tracking & Approval',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#dc2626',
        orientation: 'portrait',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
