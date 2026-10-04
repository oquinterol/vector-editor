import React, { useEffect, useMemo, useRef, useState } from 'react'
import { baseIndexAt, gcContent, IUPAC_LETTERS, parseSequence, toFasta, type Site } from '../core'
import { inRange, type Region, type SeqRange } from './FastaView'
import type { Labels } from './labels'

interface Props {
	value: string
	onChange: (value: string) => void
	/** Bases selected in the text, reported so the map can mark them. */
	onSelectRange: (range: SeqRange | null) => void
	/** Reverse-complements the sequence (mirroring regions); lines fit `columns`. */
	onReverse: (columns: number) => void
	regions: Region[]
	sites: Site[]
	range: SeqRange | null
	labels: Labels
}

const VALID = new RegExp(`[${IUPAC_LETTERS}]`, 'i')

/**
 * Colour runs for the text exactly as typed: the header line, then each base with the
 * colour of its region, its recognition sites and the current selection.
 */
function colourRuns(text: string, regions: Region[], sites: Site[], range: SeqRange | null, length: number) {
	const kind = new Uint8Array(length)
	const site = new Uint8Array(length)
	for (const region of regions) {
		for (let i = region.start; i < region.end && i < length; i++) kind[i] = region.kind === 'insert' ? 2 : 1
	}
	for (const s of sites) {
		for (let i = s.start; i < s.start + s.length; i++) if (length) site[i % length] = 1
	}
	const runs: Array<{ text: string; className: string }> = []
	let base = 0
	let inHeader = false
	let lineStart = true
	for (const char of text) {
		let className = ''
		if (lineStart && char === '>') inHeader = true
		if (char === '\n') {
			inHeader = false
			lineStart = true
		} else {
			lineStart = false
			if (inHeader) className = 'is-header'
			else if (VALID.test(char) && base < length) {
				className = [
					kind[base] === 1 ? 'is-vector' : kind[base] === 2 ? 'is-insert' : '',
					site[base] ? 'is-site' : '',
					range && inRange(range, base) ? 'is-selected' : ''
				]
					.filter(Boolean)
					.join(' ')
				base++
			} else if (!/\s|\d/.test(char)) className = 'is-invalid'
		}
		const last = runs[runs.length - 1]
		if (last && last.className === className) last.text += char
		else runs.push({ text: char, className })
	}
	return runs
}

/** Paste or type a sequence (FASTA or raw); colours and the map follow as you type. */
export function SequenceEditor({
	value,
	onChange,
	onSelectRange,
	onReverse,
	regions,
	sites,
	range,
	labels
}: Props) {
	const area = useRef<HTMLTextAreaElement>(null)
	const backdrop = useRef<HTMLPreElement>(null)
	const parsed = parseSequence(value, 'sequence')
	const gc = gcContent(parsed.seq)
	// Null until measured; the one-time reflow waits for the real width.
	const [measured, setMeasured] = useState<number | null>(null)
	const columns = measured ?? 60

	// Lines that fit the box (blocks of ten), so FASTA never wraps mid-line on a phone.
	useEffect(() => {
		const element = area.current
		if (!element || typeof ResizeObserver === 'undefined') return
		const probe = document.createElement('span')
		probe.textContent = 'ACGTACGTAC'
		const style = getComputedStyle(element)
		probe.style.cssText = `position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre;font:${style.font}`
		document.body.appendChild(probe)
		const measure = () => {
			const charWidth = probe.getBoundingClientRect().width / 10
			const inner = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
			if (charWidth > 0 && inner > 0) setMeasured(Math.min(80, Math.max(20, Math.floor(inner / charWidth / 10) * 10)))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => {
			observer.disconnect()
			probe.remove()
		}
	}, [])

	// When the editor opens on generated FASTA that is wider than the box, reflow it once.
	const reflowed = useRef(false)
	useEffect(() => {
		if (reflowed.current || measured === null || !parsed.seq) return
		const widest = Math.max(
			...value
				.split('\n')
				.filter((line) => !line.startsWith('>'))
				.map((line) => line.length)
		)
		if (widest > columns) onChange(toFasta(parsed.name, parsed.seq, '', columns))
		reflowed.current = true
	}, [measured])

	const runs = useMemo(
		() => colourRuns(value, regions, sites, range, parsed.seq.length),
		[value, regions, sites, range, parsed.seq.length]
	)

	const syncScroll = () => {
		if (area.current && backdrop.current) {
			backdrop.current.scrollTop = area.current.scrollTop
			backdrop.current.scrollLeft = area.current.scrollLeft
		}
	}
	useEffect(syncScroll, [value])

	const reportSelection = () => {
		const element = area.current
		if (!element) return
		const start = baseIndexAt(value, element.selectionStart)
		const end = baseIndexAt(value, element.selectionEnd)
		onSelectRange(end > start ? { start, end } : null)
	}

	return (
		<div className='ve-editor'>
			<div className='ve-editor-field'>
				<pre className='ve-editor-backdrop' ref={backdrop} aria-hidden='true'>
					{runs.map((run, i) => (
						<span key={i} className={run.className || undefined}>
							{run.text}
						</span>
					))}
					{/* Keeps the last empty line the same height as in the textarea. */}
					{'\n'}
				</pre>
				<textarea
					ref={area}
					className='ve-editor-text'
					aria-label={labels.editSequence}
					value={value}
					spellCheck={false}
					autoCapitalize='characters'
					autoCorrect='off'
					autoComplete='off'
					placeholder={'>my_plasmid\nATGC…'}
					onChange={(event) => onChange(event.target.value)}
					onSelect={reportSelection}
					onScroll={syncScroll}
				/>
			</div>
			<div className='ve-editor-bar'>
				<span className='ve-stat'>
					<strong>{parsed.seq.length.toLocaleString()}</strong> {labels.bp}
				</span>
				<span className='ve-stat'>
					GC <strong>{Number.isNaN(gc) ? '—' : `${(gc * 100).toFixed(1)}%`}</strong>
				</span>
				{parsed.invalid.length > 0 && (
					<span className='ve-stat ve-stat-warn'>{labels.warnings.invalid(parsed.invalid.join(' '))}</span>
				)}
				<span className='ve-editor-actions'>
					<button
						type='button'
						className='ve-link'
						onClick={() => onChange(toFasta(parsed.name, parsed.seq, '', columns))}
						disabled={!parsed.seq}
					>
						{labels.format}
					</button>
					<button type='button' className='ve-link' onClick={() => onReverse(columns)} disabled={!parsed.seq}>
						{labels.reverseComplement}
					</button>
					<button type='button' className='ve-link' onClick={() => onChange(`>${parsed.name}\n`)}>
						{labels.clear}
					</button>
				</span>
			</div>
		</div>
	)
}
