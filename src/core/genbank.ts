export interface Feature {
	type: string
	/** 0-based, half-open; on a circular sequence `start >= end` means it wraps the origin. */
	start: number
	end: number
	strand: 1 | -1
	label: string
	note?: string
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function location(feature: Feature, length: number): string {
	const span =
		feature.start < feature.end
			? `${feature.start + 1}..${feature.end}`
			: `join(${feature.start + 1}..${length},1..${feature.end})`
	return feature.strand === -1 ? `complement(${span})` : span
}

const quote = (value: string) => value.replace(/"/g, "'")

/** Annotated GenBank flat file, readable by SnapGene, Benchling, ApE and Biopython. */
export function toGenBank(
	name: string,
	seq: string,
	features: Feature[],
	{ circular = true, definition = '', date = new Date() } = {}
): string {
	const locus = (name.replace(/\s+/g, '_') || 'sequence').slice(0, 16)
	const day = String(date.getUTCDate()).padStart(2, '0')
	const stamp = `${day}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`
	const lines = [
		`LOCUS       ${locus.padEnd(16)} ${String(seq.length).padStart(11)} bp    DNA     ${circular ? 'circular' : 'linear  '} SYN ${stamp}`,
		`DEFINITION  ${definition || `${name}.`}`,
		'ACCESSION   .',
		'VERSION     .',
		'KEYWORDS    .',
		'SOURCE      synthetic DNA construct',
		'  ORGANISM  synthetic DNA construct',
		'FEATURES             Location/Qualifiers',
		`     source          1..${seq.length}`,
		'                     /mol_type="other DNA"',
		'                     /organism="synthetic DNA construct"'
	]
	for (const feature of features) {
		lines.push(`     ${feature.type.padEnd(16)}${location(feature, seq.length)}`)
		lines.push(`                     /label="${quote(feature.label)}"`)
		if (feature.note) lines.push(`                     /note="${quote(feature.note)}"`)
	}
	lines.push('ORIGIN')
	const lower = seq.toLowerCase()
	for (let i = 0; i < lower.length; i += 60) {
		const blocks = lower.slice(i, i + 60).match(/.{1,10}/g) ?? []
		lines.push(`${String(i + 1).padStart(9)} ${blocks.join(' ')}`)
	}
	lines.push('//')
	return lines.join('\n') + '\n'
}
