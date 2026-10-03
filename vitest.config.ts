import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts, whose root is the standalone app.
export default defineConfig({
	test: { include: ['test/**/*.test.ts'] }
})
