import { reverseComplement, siteToRegexSource } from './iupac'
import type { Cut, Enzyme, Site } from './types'

const mod = (value: number, length: number) => ((value % length) + length) % length

/**
 * Finds every recognition site of an enzyme on both strands. On a circular
 * sequence, sites spanning the origin are included (start + length > seq length).
 */
export function findSites(seq: string, enzyme: Enzyme, circular: boolean): Site[] {
	const length = seq.length
	const n = enzyme.site.length
	if (length === 0 || n === 0 || (!circular && length < n)) return []
	const text = circular ? seq + seq.slice(0, n - 1) : seq
	const forward = enzyme.site.toUpperCase()
	const reverse = reverseComplement(forward)
	const patterns: Array<[string, 1 | -1]> = [[forward, 1]]
	if (reverse !== forward) patterns.push([reverse, -1])
	const sites: Site[] = []
	for (const [pattern, strand] of patterns) {
		const regex = new RegExp(`(?=${siteToRegexSource(pattern)})`, 'g')
		for (const match of text.matchAll(regex)) {
			if (match.index < length) sites.push({ enzyme: enzyme.name, start: match.index, length: n, strand })
		}
	}
	return sites.sort((a, b) => a.start - b.start)
}

/**
 * Finds every cut an enzyme makes, on both strands. On a circular sequence,
 * positions are normalised so that `top` lies in [0, length) while the
 * top/bottom offset is preserved.
 */
export function findCuts(seq: string, enzyme: Enzyme, circular: boolean): Cut[] {
	const length = seq.length
	const n = enzyme.site.length
	const cuts: Cut[] = []
	for (const { start: p, strand } of findSites(seq, enzyme, circular)) {
		// On the reverse strand the enzyme's top cut lands on our bottom strand.
		const top = strand === 1 ? p + enzyme.cut : p + n - enzyme.cutComplement
		const bottom = strand === 1 ? p + enzyme.cutComplement : p + n - enzyme.cut
		if (circular) {
			const normalised = mod(top, length)
			cuts.push({ enzyme: enzyme.name, top: normalised, bottom: normalised + (bottom - top), strand })
		} else if (top > 0 && top < length && bottom > 0 && bottom < length) {
			cuts.push({ enzyme: enzyme.name, top, bottom, strand })
		}
	}
	return dedupe(cuts).sort((a, b) => a.top - b.top || a.bottom - b.bottom)
}

/** All cuts for several enzymes, merged and sorted by position. */
export function findAllCuts(seq: string, enzymes: Enzyme[], circular: boolean): Cut[] {
	return dedupe(enzymes.flatMap((enzyme) => findCuts(seq, enzyme, circular))).sort(
		(a, b) => a.top - b.top || a.bottom - b.bottom
	)
}

function dedupe(cuts: Cut[]): Cut[] {
	const seen = new Set<string>()
	return cuts.filter((cut) => {
		const key = `${cut.enzyme}:${cut.top}:${cut.bottom}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}
