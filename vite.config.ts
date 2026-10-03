import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Standalone app served at vector-editor.oquinterol.com (GitHub Pages, custom domain).
export default defineConfig({
	root: 'app',
	base: '/',
	plugins: [react()],
	build: { outDir: '../app-dist', emptyOutDir: true }
})
