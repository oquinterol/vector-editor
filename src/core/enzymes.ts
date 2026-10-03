import catalog from '../data/enzymes.json'
import { IUPAC_LETTERS } from './iupac'
import type { Enzyme } from './types'

export const rebaseVersion: string = catalog.version
export const suppliers: Record<string, string> = catalog.suppliers
export const commercialEnzymes: Enzyme[] = catalog.enzymes

const SITE = new RegExp(`^[${IUPAC_LETTERS}]+$`)

/**
 * Parses a custom enzyme written in REBASE notation:
 *   G^AATTC        palindromic site, top cut marked with ^
 *   G^AATT_C       explicit top (^) and bottom (_) cuts
 *   GGTCTC(1/5)    cuts outside the site (type IIS), counted after its 3' end
 */
export function parseEnzyme(name: string, spec: string): Enzyme {
	const clean = spec.trim().toUpperCase().replace(/\s+/g, '')
	const label = name.trim()
	if (!label) throw new Error('Enzyme name is required')

	const outside = clean.match(/^([A-Z]+)\((-?\d+)\/(-?\d+)\)$/)
	if (outside) {
		const site = outside[1]!
		if (!SITE.test(site)) throw new Error(`Invalid site ${site}`)
		return {
			name: label,
			site,
			cut: site.length + Number(outside[2]),
			cutComplement: site.length + Number(outside[3]),
			suppliers: [],
			custom: true
		}
	}

	const top = clean.indexOf('^')
	if (top < 0) throw new Error('Mark the cut with ^ (e.g. G^AATTC) or use GGTCTC(1/5)')
	const bottomMarker = clean.indexOf('_')
	const site = clean.replace(/[\^_]/g, '')
	if (!SITE.test(site)) throw new Error(`Invalid site ${site}`)
	const cut = top - (bottomMarker >= 0 && bottomMarker < top ? 1 : 0)
	const cutComplement =
		bottomMarker >= 0 ? bottomMarker - (top < bottomMarker ? 1 : 0) : site.length - cut
	return { name: label, site, cut, cutComplement, suppliers: [], custom: true }
}

/** REBASE-style label: G^AATTC, or GGTCTC(1/5) when the cut falls outside the site. */
export function formatSite(enzyme: Enzyme): string {
	const { site, cut, cutComplement } = enzyme
	const n = site.length
	if (cut >= 0 && cut <= n && cutComplement === n - cut) {
		return `${site.slice(0, cut)}^${site.slice(cut)}`
	}
	if (cut > n || cutComplement > n) return `${site}(${cut - n}/${cutComplement - n})`
	const marks = [
		[cut, '^'],
		[cutComplement, '_']
	] as const
	let out = site
	for (const [position, mark] of [...marks].sort((a, b) => b[0] - a[0])) {
		out = out.slice(0, position) + mark + out.slice(position)
	}
	return out
}
