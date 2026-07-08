import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // This tells the browser to automatically update the app on users' phones 
      // if you push new code to your live server.
      registerType: 'autoUpdate', 
      
      // These are fallback icons it will look for
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'], 
      
      // The core app configuration
      manifest: {
        name: 'Gloobal Network',
        short_name: 'Gloobal',
        description: 'The decentralized financial gateway.',
        theme_color: '#ffffff', // The color of the phone's top status bar
        background_color: '#ffffff', // The loading screen color
        display: 'standalone', // CRITICAL: This hides the browser URL bar so it feels like a native app
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.jpeg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpeg',
            sizes: '512x512',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable' // Helps Android smoothly shape the icon on the home screen
          }
        ]
      }
    })
  ]
})

