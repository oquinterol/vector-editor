const CODES: Record<string, string> = {
	A: 'A', C: 'C', G: 'G', T: 'T', U: 'T',
	R: '[AG]', Y: '[CT]', S: '[CG]', W: '[AT]', K: '[GT]', M: '[AC]',
	B: '[CGT]', D: '[AGT]', H: '[ACT]', V: '[ACG]', N: '[ACGT]'
}
const COMPLEMENT: Record<string, string> = {
	A: 'T', T: 'A', U: 'A', G: 'C', C: 'G', R: 'Y', Y: 'R', S: 'S', W: 'W',
	K: 'M', M: 'K', B: 'V', V: 'B', D: 'H', H: 'D', N: 'N'
}

export const IUPAC_LETTERS = Object.keys(CODES).join('')

export function reverseComplement(seq: string): string {
	let out = ''
	for (let i = seq.length - 1; i >= 0; i--) out += COMPLEMENT[seq[i]!] ?? 'N'
	return out
}

/** Regex source matching an IUPAC site against an unambiguous sequence. */
export function siteToRegexSource(site: string): string {
	return [...site.toUpperCase()]
		.map((letter) => {
			const code = CODES[letter]
			if (!code) throw new Error(`Invalid IUPAC letter "${letter}" in site ${site}`)
			return code
		})
		.join('')
}
