import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import { SeqViz } from 'seqviz'
import {
	formatSite,
	fragmentLength,
	leftEnd,
	parseEnzyme,
	rebaseVersion,
	rightEnd,
	suppliers,
	toFasta,
	type End,
	type Fragment
} from '../core'
import { EnzymeCombobox } from './EnzymeCombobox'
import { FastaView } from './FastaView'
import { SequenceEditor } from './SequenceEditor'
import { labelsEn, type Labels } from './labels'
import { fastaOf, useCloning, type Filter } from './useCloning'

export interface VectorEditorProps {
	labels?: Labels
	/** Domain colours shared by the map and the FASTA: vector, insert, enzymes. */
	colors?: { vector: string; insert: string; enzyme: string }
	/** localStorage key for custom enzymes; null disables persistence. */
	storageKey?: string | null
	/** `app` fills the viewport and enables global shortcuts; `embedded` fits inside a page. */
	layout?: 'embedded' | 'app'
	/** Rendered at the start of the toolbar (e.g. the app name). */
	brand?: ReactNode
}

function endLabel(end: End, labels: Labels): string {
	switch (end.type) {
		case 'none':
			return labels.noEnd
		case 'blunt':
			return `${end.enzyme} · ${labels.blunt}`
		case '5prime':
			return `${end.enzyme} · ${labels.fivePrime} ${end.overhang}`
		case '3prime':
			return `${end.enzyme} · ${labels.threePrime} ${end.overhang}`
	}
}

async function readFile(file: File): Promise<string> {
	const text = await file.text()
	if (/^\s*>/.test(text) || /^[\sACGTURYSWKMBDHVN\d]+$/i.test(text)) return text
	// GenBank, SnapGene and friends: parsed locally by seqparse.
	const { default: seqparse } = await import('seqparse')
	const source = /\.dna$/i.test(file.name) ? await file.arrayBuffer() : undefined
	const parsed = await seqparse(text, { fileName: file.name, source })
	return fastaOf(parsed.name || file.name.replace(/\.[^.]+$/, ''), parsed.seq)
}

function saveFile(name: string, text: string, extension: string, type: string) {
	const url = URL.createObjectURL(new Blob([text], { type }))
	const link = document.createElement('a')
	link.href = url
	link.download = `${name.replace(/[^\w.-]+/g, '_')}.${extension}`
	link.click()
	URL.revokeObjectURL(url)
}

type Tab = 'map' | 'sequence' | 'build'

const isTyping = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Vector or insert: a one-line summary that opens into an editor; accepts dropped files. */
function SequenceCard(props: {
	id: string
	label: string
	name: string
	length: number
	circular: boolean
	value: string
	onChange: (value: string) => void
	labels: Labels
}) {
	const { id, label, name, length, circular, value, onChange, labels } = props
	const [editing, setEditing] = useState(false)
	const [dragging, setDragging] = useState(false)
	const open = editing || length === 0
	return (
		<div
			className='ve-card'
			data-dragging={dragging}
			onDragOver={(event) => {
				event.preventDefault()
				setDragging(true)
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={async (event) => {
				event.preventDefault()
				setDragging(false)
				const file = event.dataTransfer.files[0]
				if (file) onChange(await readFile(file))
			}}
		>
			<div className='ve-card-head'>
				<span className='ve-card-label'>{label}</span>
				<span className='ve-card-name' title={name}>
					{length ? name : labels.empty}
				</span>
				<span className='ve-muted'>
					{length.toLocaleString()} {labels.bp} · {circular ? labels.circular : labels.linear}
				</span>
			</div>
			{open && (
				<textarea
					id={id}
					aria-label={label}
					value={value}
					spellCheck={false}
					placeholder={labels.pasteHint}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
			<div className='ve-card-actions'>
				{length > 0 && (
					<button type='button' className='ve-link' onClick={() => setEditing(!editing)} aria-expanded={open}>
						{open ? labels.done : labels.edit}
					</button>
				)}
				<label className='ve-link ve-file'>
					{labels.upload}
					<input
						type='file'
						accept='.fa,.fasta,.fna,.txt,.seq,.gb,.gbk,.genbank,.dna'
						onChange={async (event) => {
							const file = event.target.files?.[0]
							if (file) onChange(await readFile(file))
							event.target.value = ''
						}}
					/>
				</label>
				{length > 0 && (
					<button type='button' className='ve-link' onClick={() => onChange('')}>
						{labels.clear}
					</button>
				)}
				<span className='ve-muted ve-drop-hint'>{labels.dropHint}</span>
			</div>
		</div>
	)
}

function FragmentList(props: {
	title: string
	name: string
	fragments: Fragment[]
	selected: number
	onSelect: (index: number) => void
	labels: Labels
}) {
	const { title, name, fragments, selected, onSelect, labels } = props
	return (
		<fieldset className='ve-fragment-list'>
			<legend>{title}</legend>
			{fragments.length === 0 && <p className='ve-muted'>{labels.none}</p>}
			{fragments.map((fragment, i) => (
				<label key={`${fragment.sourceStart}-${i}`} className={i === selected ? 'is-on' : undefined}>
					<input type='radio' name={name} checked={i === selected} onChange={() => onSelect(i)} />
					<strong>{fragmentLength(fragment).toLocaleString()}</strong>
					<span className='ve-muted'>
						{endLabel(leftEnd(fragment), labels)} → {endLabel(rightEnd(fragment), labels)}
					</span>
				</label>
			))}
		</fieldset>
	)
}

export function VectorEditor({
	labels = labelsEn,
	colors = { vector: '#5ed9d1', insert: '#a4e66d', enzyme: '#ff6b9a' },
	storageKey = 'vector-editor.custom-enzymes',
	layout = 'embedded',
	brand
}: VectorEditorProps) {
	const c = useCloning(labels, storageKey)
	const root = useRef<HTMLDivElement>(null)
	// Narrow or portrait: one panel at a time, switched from a bottom tab bar.
	const [compact, setCompact] = useState(false)
	// Phone in landscape: little height, so the tabs move to a side rail.
	const [short, setShort] = useState(false)
	const [tab, setTab] = useState<Tab>('map')
	const [fastaMode, setFastaMode] = useState<'view' | 'edit'>('view')

	// Measured on the editor itself, so it works inside a page as well as full screen.
	useEffect(() => {
		const element = root.current
		if (!element || typeof ResizeObserver === 'undefined') return
		const portrait = window.matchMedia('(orientation: portrait)')
		const update = () => {
			const width = element.getBoundingClientRect().width
			setCompact(width < 900 || (portrait.matches && width < 1200) || window.innerHeight < 520)
			setShort(window.innerHeight < 520 && window.innerWidth > window.innerHeight)
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		portrait.addEventListener('change', update)
		window.addEventListener('resize', update)
		return () => {
			observer.disconnect()
			portrait.removeEventListener('change', update)
			window.removeEventListener('resize', update)
		}
	}, [])
	const [copied, setCopied] = useState<'all' | 'selection' | null>(null)
	const [customName, setCustomName] = useState('')
	const [customSite, setCustomSite] = useState('')
	const [customError, setCustomError] = useState('')

	const copy = async (which: 'all' | 'selection') => {
		const text =
			which === 'selection' && c.range
				? toFasta(`${c.resultName}_${c.range.start + 1}-${c.range.end}`, c.selectedSeq)
				: c.resultFasta
		try {
			await navigator.clipboard.writeText(text)
			setCopied(which)
			window.setTimeout(() => setCopied(null), 1500)
		} catch {
			/* Clipboard can be blocked; the FASTA stays selectable. */
		}
	}
	const downloadFasta = () => saveFile(c.resultName, c.resultFasta, 'fasta', 'text/x-fasta')
	const downloadGenBank = () => saveFile(c.resultName, c.genbank(), 'gb', 'text/plain')

	// Keyboard shortcuts: everywhere in the app layout, only while focus is inside when embedded.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
			if (layout === 'embedded' && !root.current?.contains(document.activeElement)) return
			const key = event.key.toLowerCase()
			if (key === '/') {
				event.preventDefault()
				setTab('build')
				// Wait for the build panel to be shown before focusing its search box.
				window.setTimeout(() => root.current?.querySelector<HTMLInputElement>('.ve-combobox input')?.focus())
			} else if (key === 'c' && c.resultSeq) {
				void copy(c.range ? 'selection' : 'all')
			} else if (key === 'd' && c.resultSeq) {
				downloadFasta()
			} else if (key === 'g' && c.resultSeq) {
				downloadGenBank()
			} else if (key === 'escape') {
				c.select(null, 'legend')
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const addCustom = () => {
		try {
			const enzyme = parseEnzyme(customName, customSite)
			if (c.byName.has(enzyme.name)) throw new Error(`${enzyme.name} already exists`)
			c.saveCustom([...c.custom, enzyme])
			c.setSelected((current) => [...current, enzyme.name])
			setCustomName('')
			setCustomSite('')
			setCustomError('')
		} catch (error) {
			setCustomError((error as Error).message)
		}
	}

	// Arcs follow the regions, so they survive (and move with) manual editing.
	const annotations = c.regions
		.filter(() => c.product || c.editing)
		.map((region) => ({
			name: region.kind === 'insert' ? c.insert.name : c.vector.name,
			start: region.start,
			end: region.end,
			direction:
				region.kind === 'insert'
					? c.editing
						? c.insertDirection
						: c.product?.orientation === 'forward'
							? 1
							: -1
					: 1,
			color: region.kind === 'insert' ? colors.insert : colors.vector
		}))
	const legend = [
		...c.regions.map((region) => ({
			key: region.kind,
			kind: region.kind,
			label: region.kind === 'insert' ? c.insert.name : c.vector.name,
			range: { start: region.start, end: region.end }
		})),
		...c.sites.map((site, i) => ({
			key: `${site.enzyme}-${site.start}-${i}`,
			kind: 'site' as const,
			label: `${site.enzyme} ${site.start + 1}`,
			range: { start: site.start, end: (site.start + site.length) % c.resultSeq.length || c.resultSeq.length }
		}))
	]

	return (
		<div
			ref={root}
			tabIndex={-1}
			className={`ve ve--${layout}`}
			data-compact={compact || undefined}
			data-tab={compact ? tab : undefined}
			data-short={(compact && short) || undefined}
			style={
				{ '--ve-vector': colors.vector, '--ve-insert': colors.insert, '--ve-site': colors.enzyme } as React.CSSProperties
			}
			// Clicking anywhere in the editor scopes the embedded shortcuts to it.
			onPointerDown={() => {
				if (!root.current?.contains(document.activeElement)) root.current?.focus({ preventScroll: true })
			}}
		>
			<header className='ve-toolbar'>
				{brand}
				<div className='ve-product' aria-live='polite'>
					<strong title={c.resultName}>{c.resultSeq ? c.resultName : labels.empty}</strong>
					{c.resultSeq && (
						<span className='ve-muted'>
							{c.resultSeq.length.toLocaleString()} {labels.bp} · {labels.circular}
							{c.product && ` · ${c.product.orientation === 'forward' ? labels.forward : labels.reverse}`}
							{!c.product && ` · ${c.editing ? labels.manualEdit : labels.vectorOnly}`}
						</span>
					)}
					{c.warnings.length > 0 && (
						<a
							className='ve-warn-badge'
							href='#ve-warnings'
							onClick={(event) => {
								if (!compact) return
								event.preventDefault()
								setTab('build')
							}}
						>
							{labels.warningsCount(c.warnings.length)}
						</a>
					)}
				</div>
				<div className='ve-actions'>
					<button type='button' className='ve-button' onClick={() => copy('all')} disabled={!c.resultSeq}>
						{copied === 'all' ? labels.copied : labels.copy} <kbd>C</kbd>
					</button>
					<button type='button' className='ve-button' onClick={downloadFasta} disabled={!c.resultSeq}>
						FASTA <kbd>D</kbd>
					</button>
					<button type='button' className='ve-button ve-primary' onClick={downloadGenBank} disabled={!c.resultSeq}>
						GenBank <kbd>G</kbd>
					</button>
				</div>
			</header>

			<div className='ve-body'>

				<aside className='ve-sidebar' id='ve-panel-build' aria-label={labels.construction}>
					{c.editing && (
						<section className='ve-section ve-mode'>
							<h3>{labels.manualMode}</h3>
							<p className='ve-muted'>{labels.manualModeHint}</p>
							<button
								type='button'
								className='ve-button'
								onClick={() => {
									c.backToCloning()
									setFastaMode('view')
								}}
							>
								{labels.backToCloning}
							</button>
						</section>
					)}
					{!c.editing && (
					<section className='ve-section'>
						<div className='ve-section-head'>
							<h3>{labels.sequences}</h3>
							<button type='button' className='ve-link' onClick={c.loadExample}>
								{labels.loadExample}
							</button>
						</div>
						<SequenceCard
							id='ve-vector'
							label={labels.vector}
							name={c.vector.name}
							length={c.vector.seq.length}
							circular
							value={c.vectorText}
							onChange={c.setVectorText}
							labels={labels}
						/>
						<SequenceCard
							id='ve-insert'
							label={labels.insert}
							name={c.insert.name}
							length={c.insert.seq.length}
							circular={false}
							value={c.insertText}
							onChange={c.setInsertText}
							labels={labels}
						/>
					</section>
					)}

					<section className='ve-section' aria-labelledby='ve-enzymes'>
						<div className='ve-section-head'>
							<h3 id='ve-enzymes'>{labels.enzymes}</h3>
							<span className='ve-muted'>
								<kbd>/</kbd> {labels.searchShortcut}
							</span>
						</div>
						<EnzymeCombobox
							options={c.options}
							counts={c.counts}
							selected={c.selected}
							onToggle={c.toggle}
							labels={labels}
						/>
						<div className='ve-chips'>
							{c.chosen.length
								? c.chosen.map((e) => (
										<button
											key={e.name}
											type='button'
											className='ve-chip'
											onClick={() => c.toggle(e.name)}
											title={`${formatSite(e)} · ${labels.remove}`}
										>
											{e.name} <code>{formatSite(e)}</code> <span aria-hidden='true'>×</span>
											<span className='ve-sr'>{labels.remove}</span>
										</button>
									))
								: <span className='ve-muted'>{labels.none}</span>}
						</div>
						<div className='ve-filters'>
							<label>
								{labels.show}
								<select value={c.filter} onChange={(event) => c.setFilter(event.target.value as Filter)}>
									<option value='both'>{labels.showCutsBoth}</option>
									<option value='vector'>{labels.showCutsVector}</option>
									<option value='all'>{labels.showAll}</option>
								</select>
							</label>
							<label>
								{labels.supplier}
								<select value={c.supplier} onChange={(event) => c.setSupplier(event.target.value)}>
									<option value=''>{labels.anySupplier}</option>
									{Object.entries(suppliers).map(([code, name]) => (
										<option key={code} value={code}>
											{name}
										</option>
									))}
								</select>
							</label>
						</div>
						<details className='ve-custom'>
							<summary>{labels.custom}</summary>
							<div className='ve-custom-form'>
								<input
									value={customName}
									placeholder={labels.customName}
									aria-label={labels.customName}
									onChange={(event) => setCustomName(event.target.value)}
								/>
								<input
									value={customSite}
									placeholder='G^AATTC'
									aria-label={labels.customSite}
									onChange={(event) => setCustomSite(event.target.value)}
								/>
								<button type='button' className='ve-button' onClick={addCustom}>
									{labels.add}
								</button>
							</div>
							<p className='ve-muted'>{labels.customHint}</p>
							{customError && <p className='ve-error'>{customError}</p>}
							{c.custom.length > 0 && (
								<ul className='ve-custom-list'>
									{c.custom.map((enzyme) => (
										<li key={enzyme.name}>
											<code>
												{enzyme.name} {formatSite(enzyme)}
											</code>
											<button
												type='button'
												className='ve-link'
												onClick={() => {
													c.saveCustom(c.custom.filter((e) => e.name !== enzyme.name))
													c.setSelected((current) => current.filter((n) => n !== enzyme.name))
												}}
											>
												{labels.remove}
											</button>
										</li>
									))}
								</ul>
							)}
						</details>
					</section>

					{!c.editing && (
					<section className='ve-section' aria-labelledby='ve-fragments'>
						<h3 id='ve-fragments'>
							{labels.fragments} <span className='ve-muted'>({labels.bp})</span>
						</h3>
						<FragmentList
							title={labels.vectorFragment}
							name='ve-vector-fragment'
							fragments={c.vectorFragments}
							selected={c.vectorIndex}
							onSelect={c.setVectorChoice}
							labels={labels}
						/>
						<FragmentList
							title={labels.insertFragment}
							name='ve-insert-fragment'
							fragments={c.insertFragments}
							selected={c.insertIndex}
							onSelect={c.setInsertChoice}
							labels={labels}
						/>
						{c.products.length > 1 && (
							<fieldset className='ve-orientation'>
								<legend>{labels.orientation}</legend>
								{c.products.map((p, i) => (
									<label key={p.orientation}>
										<input
											type='radio'
											name='ve-orientation'
											checked={c.orientation === i}
											onChange={() => c.setOrientation(i)}
										/>
										{p.orientation === 'forward' ? labels.forward : labels.reverse}
									</label>
								))}
							</fieldset>
						)}
					</section>
					)}

					{c.warnings.length > 0 && (
						<section className='ve-section' id='ve-warnings' aria-live='polite'>
							<ul className='ve-warnings'>
								{c.warnings.map((warning) => (
									<li key={warning}>{warning}</li>
								))}
							</ul>
						</section>
					)}

					<p className='ve-muted ve-footnote'>
						{labels.data(rebaseVersion)} {labels.privacy}
					</p>
				</aside>

				<section className='ve-workspace' aria-label={labels.result}>
					<div className='ve-stage'>
						<div className='ve-map' id='ve-panel-map' aria-label={labels.map}>
							{c.resultSeq && (
								<SeqViz
									name={c.resultName}
									seq={c.resultSeq}
									annotations={annotations}
									enzymes={c.chosen.map((e) => ({
										name: e.name,
										rseq: e.site,
										fcut: e.cut,
										rcut: e.cutComplement,
										color: colors.enzyme
									}))}
									primers={[]}
									viewer='circular'
									showComplement={false}
									disableExternalFonts
									selection={c.range ? { start: c.range.start, end: c.range.end, clockwise: true } : undefined}
									onSelection={(selection) => {
										const { start, end } = selection
										if (start === undefined || end === undefined || start === end) return
										c.select(selection.clockwise === false ? { start: end, end: start } : { start, end }, 'map')
									}}
									style={{ height: '100%', width: '100%' }}
								/>
							)}
						</div>
						<div className='ve-fasta' id='ve-panel-sequence'>
							<div className='ve-fasta-head'>
								<div className='ve-segmented' role='group' aria-label={labels.sequenceView}>
									<button type='button' aria-pressed={fastaMode === 'view'} onClick={() => setFastaMode('view')}>
										{labels.view}
									</button>
									<button
										type='button'
										aria-pressed={fastaMode === 'edit'}
										onClick={() => {
											if (!c.editing) c.editResult()
											setFastaMode('edit')
										}}
									>
										{labels.edit}
									</button>
								</div>
								{c.editing && (
									<span className='ve-muted ve-editing-note'>
										{labels.editingCopy}{' '}
										<button
											type='button'
											className='ve-link'
											onClick={() => {
												c.backToCloning()
												setFastaMode('view')
											}}
										>
											{labels.backToCloning}
										</button>
									</span>
								)}
							</div>
							{c.editing && fastaMode === 'edit' ? (
								<SequenceEditor
									value={c.sequenceText}
									onChange={c.setSequenceText}
									onSelectRange={(next) => c.select(next, 'fasta')}
									onReverse={c.reverseEdit}
									regions={c.regions}
									sites={c.sites}
									range={c.range}
									labels={labels}
								/>
							) : (
								c.resultSeq && (
									<FastaView
										header={c.resultFasta.split('\n')[0] ?? ''}
										seq={c.resultSeq}
										regions={c.regions}
										sites={c.sites}
										range={c.range}
										rangeSource={c.rangeSource}
										onRange={(next) => c.select(next, 'fasta')}
										active={!compact || tab === 'sequence'}
										label='FASTA'
									/>
								)
							)}
						</div>
					</div>
					<div className='ve-statusbar'>
						<ul className='ve-legend' aria-label={labels.legend}>
							{legend.map((item) => (
								<li key={item.key}>
									<button
										type='button'
										data-kind={item.kind}
										aria-pressed={c.range?.start === item.range.start && c.range?.end === item.range.end}
										onClick={() => c.select(item.range, 'legend')}
									>
										<span className='ve-swatch' aria-hidden='true' />
										{item.label}
									</button>
								</li>
							))}
						</ul>
						<p className='ve-selection' aria-live='polite'>
							{c.range ? (
								<>
									<span>
										{labels.selection(c.range.start + 1, c.range.end || c.resultSeq.length, c.selectionLength)}
									</span>
									<button type='button' className='ve-link' onClick={() => copy('selection')}>
										{copied === 'selection' ? labels.copied : labels.copySelection}
									</button>
									<button type='button' className='ve-link' onClick={() => c.select(null, 'legend')}>
										{labels.clearSelection} <kbd>Esc</kbd>
									</button>
								</>
							) : (
								<span className='ve-muted'>{labels.selectionHint}</span>
							)}
						</p>
					</div>
				</section>
			</div>

			{compact && (
				<nav className='ve-tabs' aria-label={labels.views}>
					{(['map', 'sequence', 'build'] as const).map((id) => (
						<button
							key={id}
							type='button'
							aria-pressed={tab === id}
							aria-controls={`ve-panel-${id}`}
							onClick={() => setTab(id)}
						>
							<span className='ve-tab-icon' aria-hidden='true'>
								{id === 'map' ? '◯' : id === 'sequence' ? '≡' : '⚙'}
							</span>
							{labels.tabs[id]}
							{id === 'build' && c.warnings.length > 0 && (
								<span className='ve-tab-badge'>{c.warnings.length}</span>
							)}
						</button>
					))}
				</nav>
			)}
		</div>
	)
}
