import React, { useEffect, useMemo, useState } from 'react'
import { SeqViz } from 'seqviz'
import {
	canSelfLigate,
	commercialEnzymes,
	digest,
	findAllCuts,
	findCuts,
	formatSite,
	fragmentLength,
	leftEnd,
	ligate,
	parseEnzyme,
	parseSequence,
	rebaseVersion,
	rightEnd,
	suppliers,
	toFasta,
	type End,
	type Enzyme,
	type Fragment
} from '../core'
import { exampleEnzymes, exampleInsert, exampleVector } from '../data/examples'
import { labelsEn, type Labels } from './labels'

export interface VectorEditorProps {
	labels?: Labels
	/** Domain colours for the map: vector, insert, enzymes. */
	colors?: { vector: string; insert: string; enzyme: string }
	/** localStorage key for custom enzymes; null disables persistence. */
	storageKey?: string | null
}

type Filter = 'both' | 'vector' | 'all'

const DISCARD_WARNING_BP = 30

const fasta = (name: string, seq: string) => toFasta(name, seq)
const loadCustom = (key: string | null): Enzyme[] => {
	if (!key) return []
	try {
		const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as Enzyme[]
		return Array.isArray(stored) ? stored : []
	} catch {
		return []
	}
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
	return fasta(parsed.name || file.name.replace(/\.[^.]+$/, ''), parsed.seq)
}

function SequenceInput(props: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	labels: Labels
	circular: boolean
	length: number
}) {
	const { id, label, value, onChange, labels, circular, length } = props
	return (
		<div className='ve-input'>
			<div className='ve-input-head'>
				<label htmlFor={id}>
					{label} <span className='ve-muted'>· {circular ? labels.circular : labels.linear}</span>
				</label>
				<span className='ve-muted'>
					{length.toLocaleString()} {labels.bp}
				</span>
			</div>
			<textarea
				id={id}
				value={value}
				spellCheck={false}
				placeholder={labels.pasteHint}
				onChange={(event) => onChange(event.target.value)}
			/>
			<div className='ve-input-actions'>
				<label className='ve-button'>
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
				<button type='button' className='ve-button' onClick={() => onChange('')}>
					{labels.clear}
				</button>
			</div>
		</div>
	)
}

export function VectorEditor({
	labels = labelsEn,
	colors = { vector: '#5ed9d1', insert: '#a4e66d', enzyme: '#ff6b9a' },
	storageKey = 'vector-editor.custom-enzymes'
}: VectorEditorProps) {
	const [vectorText, setVectorText] = useState(() => fasta(exampleVector.name, exampleVector.seq))
	const [insertText, setInsertText] = useState(() => fasta(exampleInsert.name, exampleInsert.seq))
	const [selected, setSelected] = useState<string[]>(exampleEnzymes)
	const [custom, setCustom] = useState<Enzyme[]>([])
	const [query, setQuery] = useState('')
	const [supplier, setSupplier] = useState('')
	const [filter, setFilter] = useState<Filter>('both')
	const [vectorChoice, setVectorChoice] = useState<number | null>(null)
	const [insertChoice, setInsertChoice] = useState<number | null>(null)
	const [orientation, setOrientation] = useState(0)
	const [customName, setCustomName] = useState('')
	const [customSite, setCustomSite] = useState('')
	const [customError, setCustomError] = useState('')
	const [copied, setCopied] = useState(false)

	useEffect(() => setCustom(loadCustom(storageKey)), [storageKey])
	const saveCustom = (next: Enzyme[]) => {
		setCustom(next)
		if (!storageKey) return
		try {
			localStorage.setItem(storageKey, JSON.stringify(next))
		} catch {
			/* Storage is optional. */
		}
	}

	const vector = useMemo(() => parseSequence(vectorText, 'vector'), [vectorText])
	const insert = useMemo(() => parseSequence(insertText, 'insert'), [insertText])
	const allEnzymes = useMemo(() => [...custom, ...commercialEnzymes], [custom])
	const byName = useMemo(() => new Map(allEnzymes.map((e) => [e.name, e])), [allEnzymes])
	const chosen = useMemo(
		() => selected.map((name) => byName.get(name)).filter((e): e is Enzyme => Boolean(e)),
		[selected, byName]
	)

	// Cut counts for every enzyme, so the list can show only useful ones.
	const counts = useMemo(() => {
		const map = new Map<string, { vector: number; insert: number }>()
		for (const enzyme of allEnzymes) {
			map.set(enzyme.name, {
				vector: findCuts(vector.seq, enzyme, true).length,
				insert: findCuts(insert.seq, enzyme, false).length
			})
		}
		return map
	}, [allEnzymes, vector.seq, insert.seq])

	const visible = useMemo(() => {
		const q = query.trim().toUpperCase()
		return allEnzymes
			.filter((enzyme) => {
				const count = counts.get(enzyme.name)
				if (selected.includes(enzyme.name)) return true
				if (filter === 'vector' && !count?.vector) return false
				if (filter === 'both' && !(count?.vector && count.insert)) return false
				if (supplier && !enzyme.custom && !enzyme.suppliers.includes(supplier)) return false
				return !q || enzyme.name.toUpperCase().includes(q) || enzyme.site.includes(q)
			})
			.slice(0, 120)
	}, [allEnzymes, counts, filter, query, selected, supplier])

	const vectorFragments = useMemo(
		() => (chosen.length ? digest(vector.seq, findAllCuts(vector.seq, chosen, true), true) : []),
		[vector.seq, chosen]
	)
	const insertFragments = useMemo(
		() => (chosen.length ? digest(insert.seq, findAllCuts(insert.seq, chosen, false), false) : []),
		[insert.seq, chosen]
	)

	// Sensible defaults: the largest backbone and the largest insert piece cut at both ends.
	const autoVector = useMemo(() => {
		let best = -1
		vectorFragments.forEach((f, i) => {
			if (best < 0 || fragmentLength(f) > fragmentLength(vectorFragments[best]!)) best = i
		})
		return best
	}, [vectorFragments])
	const autoInsert = useMemo(() => {
		let best = -1
		insertFragments.forEach((f, i) => {
			if (!f.left || !f.right) return
			if (best < 0 || fragmentLength(f) > fragmentLength(insertFragments[best]!)) best = i
		})
		return best
	}, [insertFragments])
	useEffect(() => {
		setVectorChoice(null)
		setInsertChoice(null)
		setOrientation(0)
	}, [vector.seq, insert.seq, selected])

	const vectorIndex = vectorChoice ?? autoVector
	const insertIndex = insertChoice ?? autoInsert
	const backbone: Fragment | undefined = vectorFragments[vectorIndex]
	const piece: Fragment | undefined = insertFragments[insertIndex]
	const products = useMemo(() => (backbone && piece ? ligate(backbone, piece) : []), [backbone, piece])
	const product = products[Math.min(orientation, products.length - 1)]

	const warnings: string[] = []
	const invalid = [...new Set([...vector.invalid, ...insert.invalid])]
	if (invalid.length) warnings.push(labels.warnings.invalid(invalid.join(' ')))
	if (chosen.length && vector.seq && !vectorFragments.length) warnings.push(labels.warnings.noVectorCuts)
	for (const enzyme of chosen) {
		const n = counts.get(enzyme.name)?.vector ?? 0
		if (n > 1) warnings.push(labels.warnings.vectorMultiCut(enzyme.name, n))
	}
	if (chosen.length && insert.seq && autoInsert < 0) warnings.push(labels.warnings.noInsertFragment)
	// Flanking sites only trim a few bases; losing more means the enzymes cut inside the insert.
	const discarded = piece ? insert.seq.length - fragmentLength(piece) : 0
	if (discarded > DISCARD_WARNING_BP) warnings.push(labels.warnings.insertCutsInside(discarded))
	if (backbone && piece && !products.length) warnings.push(labels.warnings.incompatible)
	if (backbone && canSelfLigate(backbone)) warnings.push(labels.warnings.selfLigation)

	const resultName = product ? `${vector.name}-${insert.name}` : vector.name
	const resultSeq = product?.seq ?? vector.seq
	const resultFasta = resultSeq
		? toFasta(resultName, resultSeq, `circular ${resultSeq.length} ${labels.bp}`)
		: ''
	const annotations = product
		? [
				{ name: vector.name, start: 0, end: product.vectorLength, direction: 1, color: colors.vector },
				{
					name: `${insert.name} (${product.orientation === 'forward' ? labels.forward : labels.reverse})`,
					start: product.vectorLength,
					end: product.vectorLength + product.insertLength,
					direction: product.orientation === 'forward' ? 1 : -1,
					color: colors.insert
				}
			]
		: []
	const mapEnzymes = chosen.map((e) => ({
		name: e.name,
		rseq: e.site,
		fcut: e.cut,
		rcut: e.cutComplement,
		color: colors.enzyme
	}))

	const toggle = (name: string) =>
		setSelected((current) =>
			current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
		)
	const addCustom = () => {
		try {
			const enzyme = parseEnzyme(customName, customSite)
			if (byName.has(enzyme.name)) throw new Error(`${enzyme.name} already exists`)
			saveCustom([...custom, enzyme])
			setSelected((current) => [...current, enzyme.name])
			setCustomName('')
			setCustomSite('')
			setCustomError('')
		} catch (error) {
			setCustomError((error as Error).message)
		}
	}
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(resultFasta)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch {
			/* Clipboard can be blocked; the FASTA stays selectable below. */
		}
	}
	const download = () => {
		const url = URL.createObjectURL(new Blob([resultFasta], { type: 'text/x-fasta' }))
		const link = document.createElement('a')
		link.href = url
		link.download = `${resultName.replace(/[^\w.-]+/g, '_')}.fasta`
		link.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className='ve'>
			<div className='ve-inputs'>
				<SequenceInput
					id='ve-vector'
					label={labels.vector}
					value={vectorText}
					onChange={setVectorText}
					labels={labels}
					circular
					length={vector.seq.length}
				/>
				<SequenceInput
					id='ve-insert'
					label={labels.insert}
					value={insertText}
					onChange={setInsertText}
					labels={labels}
					circular={false}
					length={insert.seq.length}
				/>
			</div>
			<button
				type='button'
				className='ve-button ve-example'
				onClick={() => {
					setVectorText(fasta(exampleVector.name, exampleVector.seq))
					setInsertText(fasta(exampleInsert.name, exampleInsert.seq))
					setSelected(exampleEnzymes)
				}}
			>
				{labels.loadExample}: pUC19 + StSP6A (KpnI · XbaI)
			</button>

			<section className='ve-panel' aria-labelledby='ve-enzymes'>
				<h3 id='ve-enzymes'>{labels.enzymes}</h3>
				<p className='ve-selected'>
					{labels.selected}:{' '}
					{chosen.length
						? chosen.map((e) => (
								<button key={e.name} type='button' className='ve-chip is-on' onClick={() => toggle(e.name)}>
									{e.name} <span aria-hidden='true'>×</span>
									<span className='ve-sr'>{labels.remove}</span>
								</button>
							))
						: labels.none}
				</p>
				<div className='ve-filters'>
					<input
						type='search'
						value={query}
						placeholder={labels.search}
						aria-label={labels.search}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<label>
						{labels.supplier}
						<select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
							<option value=''>{labels.anySupplier}</option>
							{Object.entries(suppliers).map(([code, name]) => (
								<option key={code} value={code}>
									{name}
								</option>
							))}
						</select>
					</label>
					<label>
						{labels.show}
						<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
							<option value='both'>{labels.showCutsBoth}</option>
							<option value='vector'>{labels.showCutsVector}</option>
							<option value='all'>{labels.showAll}</option>
						</select>
					</label>
				</div>
				<ul className='ve-enzyme-list'>
					{visible.map((enzyme) => {
						const count = counts.get(enzyme.name)
						const on = selected.includes(enzyme.name)
						return (
							<li key={enzyme.name}>
								<label className={on ? 'is-on' : undefined}>
									<input type='checkbox' checked={on} onChange={() => toggle(enzyme.name)} />
									<strong>{enzyme.name}</strong>
									<code>{formatSite(enzyme)}</code>
									<span className='ve-muted' title={labels.cutsVector}>
										V {count?.vector ?? 0}
									</span>
									<span className='ve-muted' title={labels.cutsInsert}>
										I {count?.insert ?? 0}
									</span>
									{enzyme.custom && <span className='ve-tag'>{labels.custom}</span>}
								</label>
							</li>
						)
					})}
				</ul>
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
					{custom.length > 0 && (
						<ul className='ve-custom-list'>
							{custom.map((enzyme) => (
								<li key={enzyme.name}>
									<code>
										{enzyme.name} {formatSite(enzyme)}
									</code>
									<button
										type='button'
										className='ve-button'
										onClick={() => {
											saveCustom(custom.filter((e) => e.name !== enzyme.name))
											setSelected((current) => current.filter((n) => n !== enzyme.name))
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

			<section className='ve-panel' aria-labelledby='ve-fragments'>
				<h3 id='ve-fragments'>{labels.fragments}</h3>
				<div className='ve-fragments'>
					<FragmentList
						title={labels.vectorFragment}
						name='ve-vector-fragment'
						fragments={vectorFragments}
						selected={vectorIndex}
						onSelect={setVectorChoice}
						labels={labels}
					/>
					<FragmentList
						title={labels.insertFragment}
						name='ve-insert-fragment'
						fragments={insertFragments}
						selected={insertIndex}
						onSelect={setInsertChoice}
						labels={labels}
					/>
				</div>
				{products.length > 1 && (
					<fieldset className='ve-orientation'>
						<legend>{labels.orientation}</legend>
						{products.map((p, i) => (
							<label key={p.orientation}>
								<input
									type='radio'
									name='ve-orientation'
									checked={orientation === i}
									onChange={() => setOrientation(i)}
								/>
								{p.orientation === 'forward' ? labels.forward : labels.reverse}
							</label>
						))}
					</fieldset>
				)}
				{warnings.length > 0 && (
					<ul className='ve-warnings' aria-live='polite'>
						{warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				)}
			</section>

			<section className='ve-panel ve-result' aria-labelledby='ve-result'>
				<h3 id='ve-result'>
					{labels.result}: {product ? labels.product : labels.vector}
				</h3>
				{!product && resultSeq && <p className='ve-muted'>{labels.warnings.showingVector}</p>}
				<div className='ve-result-grid'>
					<div className='ve-map' aria-label={labels.map}>
						{resultSeq && (
							<SeqViz
								name={resultName}
								seq={resultSeq}
								annotations={annotations}
								enzymes={mapEnzymes}
								primers={[]}
								viewer='circular'
								showComplement={false}
								disableExternalFonts
								style={{ height: '100%', width: '100%' }}
							/>
						)}
					</div>
					<div className='ve-fasta'>
						<div className='ve-input-actions'>
							<button type='button' className='ve-button' onClick={copy} disabled={!resultFasta}>
								{copied ? labels.copied : labels.copy}
							</button>
							<button type='button' className='ve-button' onClick={download} disabled={!resultFasta}>
								{labels.download}
							</button>
						</div>
						<textarea readOnly value={resultFasta} spellCheck={false} aria-label='FASTA' />
					</div>
				</div>
			</section>
			<p className='ve-muted ve-footnote'>
				{labels.data(rebaseVersion)} {labels.privacy}
			</p>
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
					<strong>
						{fragmentLength(fragment).toLocaleString()} {labels.bp}
					</strong>
					<span className='ve-muted'>
						{endLabel(leftEnd(fragment), labels)} → {endLabel(rightEnd(fragment), labels)}
					</span>
				</label>
			))}
		</fieldset>
	)
}
