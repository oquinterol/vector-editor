import { reverseComplement } from './iupac'
import type { Cut, End, Fragment } from './types'

function circularSlice(seq: string, start: number, end: number): string {
	const length = seq.length
	let out = ''
	for (let i = start; i < end; i++) out += seq[((i % length) + length) % length]
	return out
}

function makeFragment(
	source: string,
	circular: boolean,
	left: Cut | undefined,
	right: Cut | undefined,
	leftTop: number,
	leftBottom: number,
	rightTop: number,
	rightBottom: number
): Fragment | null {
	const start = Math.min(leftTop, leftBottom)
	const end = Math.max(rightTop, rightBottom)
	const fragment: Fragment = {
		seq: circular ? circularSlice(source, start, end) : source.slice(start, end),
		topStart: leftTop - start,
		topEnd: rightTop - start,
		botStart: leftBottom - start,
		botEnd: rightBottom - start,
		left,
		right,
		sourceStart: ((leftTop % source.length) + source.length) % source.length
	}
	// Cuts closer together than their own overhangs cannot yield a real fragment.
	if (fragment.topEnd <= fragment.topStart || fragment.botEnd <= fragment.botStart) return null
	return fragment
}

/** Splits a sequence at the given cuts. Overlapping cuts are skipped. */
export function digest(seq: string, cuts: Cut[], circular: boolean): Fragment[] {
	const sorted = [...cuts].sort((a, b) => a.top - b.top)
	const length = seq.length
	const fragments: Fragment[] = []
	if (circular) {
		if (sorted.length === 0) return []
		sorted.forEach((left, i) => {
			const wraps = i === sorted.length - 1
			const right = sorted[(i + 1) % sorted.length]!
			const shift = wraps ? length : 0
			const fragment = makeFragment(
				seq, true, left, right,
				left.top, left.bottom, right.top + shift, right.bottom + shift
			)
			if (fragment) fragments.push(fragment)
		})
		return fragments
	}
	const bounds: Array<Cut | undefined> = [undefined, ...sorted, undefined]
	for (let i = 0; i < bounds.length - 1; i++) {
		const left = bounds[i]
		const right = bounds[i + 1]
		const fragment = makeFragment(
			seq, false, left, right,
			left?.top ?? 0, left?.bottom ?? 0, right?.top ?? length, right?.bottom ?? length
		)
		if (fragment) fragments.push(fragment)
	}
	return fragments
}

/** Top-strand sequence of a fragment. */
export function topStrand(fragment: Fragment): string {
	return fragment.seq.slice(fragment.topStart, fragment.topEnd)
}

export function fragmentLength(fragment: Fragment): number {
	return fragment.topEnd - fragment.topStart
}

export function leftEnd(fragment: Fragment): End {
	if (!fragment.left) return { type: 'none', overhang: '' }
	const { seq, topStart, botStart } = fragment
	const enzyme = fragment.left.enzyme
	if (botStart > topStart) return { type: '5prime', overhang: seq.slice(topStart, botStart), enzyme }
	if (botStart < topStart) return { type: '3prime', overhang: seq.slice(botStart, topStart), enzyme }
	return { type: 'blunt', overhang: '', enzyme }
}

export function rightEnd(fragment: Fragment): End {
	if (!fragment.right) return { type: 'none', overhang: '' }
	const { seq, topEnd, botEnd } = fragment
	const enzyme = fragment.right.enzyme
	if (botEnd > topEnd) return { type: '5prime', overhang: seq.slice(topEnd, botEnd), enzyme }
	if (botEnd < topEnd) return { type: '3prime', overhang: seq.slice(botEnd, topEnd), enzyme }
	return { type: 'blunt', overhang: '', enzyme }
}

/** The same fragment read from the other strand. */
export function flip(fragment: Fragment): Fragment {
	const n = fragment.seq.length
	return {
		seq: reverseComplement(fragment.seq),
		topStart: n - fragment.botEnd,
		topEnd: n - fragment.botStart,
		botStart: n - fragment.topEnd,
		botEnd: n - fragment.topStart,
		left: fragment.right,
		right: fragment.left,
		sourceStart: fragment.sourceStart
	}
}
