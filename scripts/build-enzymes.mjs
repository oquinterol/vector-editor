// Builds src/data/enzymes.json from REBASE EMBOSS files (rebase.neb.com).
// Keeps commercially available enzymes with two known cut positions (no
// four-cut enzymes such as BcgI), which covers what a cloning simulation needs.
import { writeFileSync } from 'node:fs'

const BASE = 'http://rebase.neb.com/rebase/'
const fetchText = async (name) => {
	const response = await fetch(BASE + name)
	if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
	return response.text()
}

const [patterns, refs, suppliersText] = await Promise.all(
	['link_emboss_e', 'link_emboss_r', 'link_emboss_s'].map(fetchText)
)
const version = patterns.match(/REBASE version (\d+)/)?.[1] ?? 'unknown'

const suppliers = Object.fromEntries(
	suppliersText
		.split('\n')
		.filter((line) => line && !line.startsWith('#'))
		.map((line) => [line[0], line.slice(2).trim()])
)

// emboss_r records: name, organism, isoschizomers, methylation, source, suppliers, refs…
const commercial = new Map()
for (const record of refs.split('//')) {
	const lines = record
		.split('\n')
		.filter((line) => !line.startsWith('#'))
		.map((line) => line.trim())
	const start = lines.findIndex((line) => line.length > 0)
	if (start < 0) continue
	const name = lines[start]
	const codes = lines[start + 5] ?? ''
	if (/^[A-Z]+$/.test(codes)) commercial.set(name, codes.split(''))
}

const enzymes = []
for (const line of patterns.split('\n')) {
	if (!line || line.startsWith('#')) continue
	const [name, site, len, ncuts, , c1, c2] = line.split(/\s+/)
	if (ncuts !== '2' || !commercial.has(name)) continue
	enzymes.push({
		name,
		site: site.toUpperCase(),
		cut: Number(c1),
		cutComplement: Number(c2),
		suppliers: commercial.get(name)
	})
	if (site.length !== Number(len)) throw new Error(`Length mismatch for ${name}`)
}
enzymes.sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(
	new URL('../src/data/enzymes.json', import.meta.url),
	JSON.stringify({ source: 'REBASE', version, suppliers, enzymes }, null, '\t') + '\n'
)
console.log(`REBASE ${version}: ${enzymes.length} commercial enzymes, ${Object.keys(suppliers).length} suppliers`)
