import React, { useEffect, useMemo, useRef } from 'react'
import type { Site } from '../core'

export interface Region {
	kind: 'vector' | 'insert'
	start: number
	end: number
}

/** A half-open range on a circular sequence; `start > end` means it wraps the origin. */
export interface SeqRange {
	start: number
	end: number
}

export type RangeSource = 'map' | 'fasta' | 'legend'

interface Props {
	header: string
	seq: string
	regions: Region[]
	sites: Site[]
	range: SeqRange | null
	rangeSource: RangeSource | null
	onRange: (range: SeqRange) => void
	width?: number
	label: string
}

const KIND = { vector: 1, insert: 2 } as const

export function inRange(range: SeqRange, i: number): boolean {
	return range.start <= range.end ? i >= range.start && i < range.end : i >= range.start || i < range.end
}

/** The FASTA of the plasmid with every base coloured by what it belongs to. */
export function FastaView({ header, seq, regions, sites, range, rangeSource, onRange, width = 60, label }: Props) {
	const box = useRef<HTMLDivElement>(null)

	// Per-base region kind and recognition-site mask, recomputed only when the plasmid changes.
	const { kind, site } = useMemo(() => {
		const kind = new Uint8Array(seq.length)
		const site = new Uint8Array(seq.length)
		for (const region of regions) {
			for (let i = region.start; i < region.end; i++) kind[i % seq.length] = KIND[region.kind]
		}
		for (const s of sites) {
			for (let i = s.start; i < s.start + s.length; i++) site[i % seq.length] = 1
		}
		return { kind, site }
	}, [seq, regions, sites])

	const lines = useMemo(() => {
		const out: Array<{ start: number; runs: Array<{ start: number; end: number; className: string }> }> = []
		for (let lineStart = 0; lineStart < seq.length; lineStart += width) {
			const lineEnd = Math.min(seq.length, lineStart + width)
			const runs: Array<{ start: number; end: number; className: string }> = []
			let runStart = lineStart
			let previous = ''
			for (let i = lineStart; i <= lineEnd; i++) {
				const className =
					i === lineEnd
						? ''
						: [
								kind[i] === 1 ? 'is-vector' : kind[i] === 2 ? 'is-insert' : '',
								site[i] ? 'is-site' : '',
								range && inRange(range, i) ? 'is-selected' : ''
							]
								.filter(Boolean)
								.join(' ')
				if (i > lineStart && (className !== previous || i === lineEnd)) {
					runs.push({ start: runStart, end: i, className: previous })
					runStart = i
				}
				previous = className
			}
			out.push({ start: lineStart, runs })
		}
		return out
	}, [seq, width, kind, site, range])

	// Follow selections made on the map or the legend.
	useEffect(() => {
		if (!range || rangeSource === 'fasta' || !box.current) return
		const line = box.current.querySelector<HTMLElement>(
			`[data-line="${Math.floor(range.start / width) * width}"]`
		)
		// The view is the offsetParent of its lines (position: relative).
		if (line) box.current.scrollTop = line.offsetTop - 24
	}, [range, rangeSource, width])

	const positionOf = (node: Node | null, offset: number): number | null => {
		const element = node instanceof Element ? node : node?.parentElement
		const run = element?.closest<HTMLElement>('[data-start]')
		if (!run || !box.current?.contains(run)) return null
		return Number(run.dataset.start) + (node instanceof Text ? offset : 0)
	}

	const onMouseUp = () => {
		const selection = window.getSelection()
		if (!selection || selection.isCollapsed) return
		const a = positionOf(selection.anchorNode, selection.anchorOffset)
		const b = positionOf(selection.focusNode, selection.focusOffset)
		if (a === null || b === null || a === b) return
		onRange({ start: Math.min(a, b), end: Math.max(a, b) })
		selection.removeAllRanges()
	}

	return (
		<div className='ve-fasta-view' ref={box} onMouseUp={onMouseUp} aria-label={label} tabIndex={0}>
			<div className='ve-fasta-header'>{header}</div>
			{lines.map((line) => (
				<div key={line.start} className='ve-line' data-line={line.start}>
					<span className='ve-pos' aria-hidden='true'>
						{line.start + 1}
					</span>
					<span className='ve-bases'>
						{line.runs.map((run) => (
							<span key={run.start} data-start={run.start} className={run.className || undefined}>
								{seq.slice(run.start, run.end)}
							</span>
						))}
					</span>
				</div>
			))}
		</div>
	)
}
