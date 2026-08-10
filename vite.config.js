import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          // Firestore separado do auth: só é importado dinamicamente, depois do
          // login. Quem navega sem conta (livros e conversas em localStorage)
          // não baixa esse pedaço, que é o maior do Firebase.
          firebase: ['firebase/app', 'firebase/auth'],
          firestore: ['firebase/firestore'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
