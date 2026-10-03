import { flip, leftEnd, rightEnd, topStrand, fragmentLength } from './digest'
import type { End, Fragment, Product } from './types'

/** Whether the right end of one fragment can be ligated to the left end of another. */
export function compatible(right: End, left: End): boolean {
	if (right.type === 'none' || left.type === 'none') return false
	return right.type === left.type && right.overhang === left.overhang
}

/**
 * Ligates an insert into a linearised vector, closing the circle. Tries both
 * insert orientations and returns every one whose two junctions match.
 */
export function ligate(vector: Fragment, insert: Fragment): Product[] {
	const products: Product[] = []
	const options: Array<[Fragment, Product['orientation']]> = [
		[insert, 'forward'],
		[flip(insert), 'reverse']
	]
	for (const [candidate, orientation] of options) {
		if (
			compatible(rightEnd(vector), leftEnd(candidate)) &&
			compatible(rightEnd(candidate), leftEnd(vector))
		) {
			products.push({
				seq: topStrand(vector) + topStrand(candidate),
				orientation,
				vectorLength: fragmentLength(vector),
				insertLength: fragmentLength(candidate)
			})
		}
	}
	return products
}

/** True when a linearised vector can close on itself without an insert. */
export function canSelfLigate(vector: Fragment): boolean {
	return compatible(rightEnd(vector), leftEnd(vector))
}
