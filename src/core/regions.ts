export interface Span {
	start: number
	end: number
}

/**
 * Moves half-open spans after an edit that turned `before` into `after`.
 * The edit is the part between their common prefix and suffix: text typed
 * inside a span grows it, deleted text shrinks it, spans after it shift.
 */
export function shiftSpans<T extends Span>(spans: T[], before: string, after: string): T[] {
	let prefix = 0
	const shortest = Math.min(before.length, after.length)
	while (prefix < shortest && before[prefix] === after[prefix]) prefix++
	let suffix = 0
	while (
		suffix < shortest - prefix &&
		before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
	)
		suffix++
	const oldEnd = before.length - suffix
	const newEnd = after.length - suffix
	const delta = after.length - before.length
	// Boundaries before the edit stay; text typed at a boundary joins the span that starts
	// there; boundaries inside the replaced stretch move to its new end.
	const move = (position: number) => {
		if (position <= prefix) return position
		if (position >= oldEnd) return position + delta
		return newEnd
	}
	return spans
		.map((span) => ({ ...span, start: move(span.start), end: move(span.end) }))
		.filter((span) => span.end > span.start)
}
