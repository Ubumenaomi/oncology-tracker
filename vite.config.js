import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const manualChunks = (id) => {
  if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
    return 'vendor-react'
  }

  if (id.includes('node_modules/firebase')) {
    return 'vendor-firebase'
  }

  if (id.includes('node_modules/lucide-react')) {
    return 'vendor-icons'
  }

  if (id.includes('/src/data/questions/year112')) {
    return 'questions-112'
  }

  if (id.includes('/src/data/questions/year113')) {
    return 'questions-113'
  }

  if (id.includes('/src/data/questions/year114')) {
    return 'questions-114'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
