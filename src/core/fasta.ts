import { IUPAC_LETTERS } from './iupac'

export interface ParsedSequence {
	name: string
	seq: string
	/** Characters that are not IUPAC nucleotides (already removed from seq). */
	invalid: string[]
}

/** Reads the first FASTA record, or a raw sequence. Whitespace and numbers are ignored. */
export function parseSequence(text: string, fallbackName = 'sequence'): ParsedSequence {
	const lines = text.replace(/\r/g, '').split('\n')
	let name = fallbackName
	const body: string[] = []
	let seenHeader = false
	for (const line of lines) {
		if (line.startsWith('>')) {
			if (seenHeader) break
			seenHeader = true
			name = line.slice(1).trim().split(/\s+/)[0] || fallbackName
			continue
		}
		body.push(line)
	}
	const raw = body.join('').replace(/[\s\d]/g, '').toUpperCase()
	const valid = new RegExp(`[${IUPAC_LETTERS}]`)
	const invalid = new Set<string>()
	let seq = ''
	for (const letter of raw) {
		if (valid.test(letter)) seq += letter === 'U' ? 'T' : letter
		else invalid.add(letter)
	}
	return { name, seq, invalid: [...invalid] }
}

export function toFasta(name: string, seq: string, description = '', width = 70): string {
	const header = `>${name.replace(/\s+/g, '_')}${description ? ` ${description}` : ''}`
	const lines = seq.match(new RegExp(`.{1,${width}}`, 'g')) ?? []
	return [header, ...lines].join('\n') + '\n'
}
