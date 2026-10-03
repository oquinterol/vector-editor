import { defineConfig } from 'tsup'

export default defineConfig({
	entry: { index: 'src/index.ts', core: 'src/core/index.ts' },
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	external: ['react', 'react-dom', 'seqviz'],
	target: 'es2022'
})
