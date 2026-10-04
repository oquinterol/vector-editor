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

/** Fraction of G and C among unambiguous bases (0–1); NaN when there are none. */
export function gcContent(seq: string): number {
	let gc = 0
	let acgt = 0
	for (const base of seq) {
		if (base === 'G' || base === 'C') gc++
		if (base === 'A' || base === 'C' || base === 'G' || base === 'T') acgt++
	}
	return acgt ? gc / acgt : Number.NaN
}

/**
 * Maps a character offset in FASTA (or raw) text to a 0-based base index,
 * skipping header lines, whitespace, digits and invalid characters.
 */
export function baseIndexAt(text: string, offset: number): number {
	let index = 0
	let inHeader = false
	let lineStart = true
	const valid = new RegExp(`[${IUPAC_LETTERS}]`, 'i')
	for (let i = 0; i < Math.min(offset, text.length); i++) {
		const char = text[i]!
		if (lineStart && char === '>') inHeader = true
		if (char === '\n') {
			inHeader = false
			lineStart = true
			continue
		}
		lineStart = false
		if (!inHeader && valid.test(char)) index++
	}
	return index
}
