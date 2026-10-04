import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
	canSelfLigate,
	commercialEnzymes,
	digest,
	findAllCuts,
	findCuts,
	findSites,
	fragmentLength,
	ligate,
	parseSequence,
	reverseComplement,
	shiftSpans,
	toFasta,
	toGenBank,
	type Enzyme,
	type Feature,
	type Fragment,
	type Site
} from '../core'
import { exampleEnzymes, exampleInsert, exampleVector } from '../data/examples'
import type { RangeSource, Region, SeqRange } from './FastaView'
import type { Labels } from './labels'

export type Filter = 'both' | 'vector' | 'all'
/** `clone` builds a plasmid from vector + insert; `sequence` edits any sequence by hand. */
export type Mode = 'clone' | 'sequence'

const DISCARD_WARNING_BP = 30

export const fastaOf = (name: string, seq: string) => toFasta(name, seq)

const loadCustom = (key: string | null): Enzyme[] => {
	if (!key) return []
	try {
		const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as Enzyme[]
		return Array.isArray(stored) ? stored : []
	} catch {
		return []
	}
}

const largestIndex = (fragments: Fragment[], accept: (f: Fragment) => boolean = () => true) => {
	let best = -1
	fragments.forEach((f, i) => {
		if (!accept(f)) return
		if (best < 0 || fragmentLength(f) > fragmentLength(fragments[best]!)) best = i
	})
	return best
}

/** All cloning state and derived results; the layout only renders what this returns. */
export function useCloning(labels: Labels, storageKey: string | null) {
	const [vectorText, setVectorText] = useState(() => fastaOf(exampleVector.name, exampleVector.seq))
	const [insertText, setInsertText] = useState(() => fastaOf(exampleInsert.name, exampleInsert.seq))
	const [selected, setSelected] = useState<string[]>(exampleEnzymes)
	const [custom, setCustom] = useState<Enzyme[]>([])
	const [supplier, setSupplier] = useState('')
	const [filter, setFilter] = useState<Filter>('both')
	const [vectorChoice, setVectorChoice] = useState<number | null>(null)
	const [insertChoice, setInsertChoice] = useState<number | null>(null)
	const [orientation, setOrientation] = useState(0)
	const [range, setRange] = useState<SeqRange | null>(null)
	const [rangeSource, setRangeSource] = useState<RangeSource | null>(null)
	const [mode, setMode] = useState<Mode>('clone')
	const [sequenceText, setSequenceTextRaw] = useState('')
	// Vector/insert regions carried into manual editing and moved along with each edit.
	const [editRegions, setEditRegions] = useState<Region[]>([])
	const [insertDirection, setInsertDirection] = useState<1 | -1>(1)
	const setSequenceText = (text: string) => {
		const before = parseSequence(sequenceText, 'sequence').seq
		const after = parseSequence(text, 'sequence').seq
		if (before !== after) setEditRegions((current) => shiftSpans(current, before, after))
		setSequenceTextRaw(text)
	}
	// Typing stays responsive: the map and sites follow a deferred copy of the text.
	const deferredSequenceText = useDeferredValue(sequenceText)

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
	const sequence = useMemo(() => parseSequence(deferredSequenceText, 'sequence'), [deferredSequenceText])
	const editing = mode === 'sequence'
	const allEnzymes = useMemo(() => [...custom, ...commercialEnzymes], [custom])
	const byName = useMemo(() => new Map(allEnzymes.map((e) => [e.name, e])), [allEnzymes])
	const chosen = useMemo(
		() => selected.map((name) => byName.get(name)).filter((e): e is Enzyme => Boolean(e)),
		[selected, byName]
	)

	const counts = useMemo(() => {
		const map = new Map<string, { vector: number; insert: number }>()
		for (const enzyme of allEnzymes) {
			map.set(enzyme.name, {
				vector: findCuts(editing ? sequence.seq : vector.seq, enzyme, true).length,
				insert: editing ? 0 : findCuts(insert.seq, enzyme, false).length
			})
		}
		return map
	}, [allEnzymes, vector.seq, insert.seq, sequence.seq, editing])

	const options = useMemo(
		() =>
			allEnzymes.filter((enzyme) => {
				const count = counts.get(enzyme.name)
				if (filter === 'vector' && !count?.vector) return false
				if (filter === 'both' && !(count?.vector && (editing || count.insert))) return false
				return !supplier || enzyme.custom || enzyme.suppliers.includes(supplier)
			}),
		[allEnzymes, counts, filter, supplier, editing]
	)

	const vectorFragments = useMemo(
		() => (chosen.length ? digest(vector.seq, findAllCuts(vector.seq, chosen, true), true) : []),
		[vector.seq, chosen]
	)
	const insertFragments = useMemo(
		() => (chosen.length ? digest(insert.seq, findAllCuts(insert.seq, chosen, false), false) : []),
		[insert.seq, chosen]
	)
	const autoVector = useMemo(() => largestIndex(vectorFragments), [vectorFragments])
	const autoInsert = useMemo(
		() => largestIndex(insertFragments, (f) => Boolean(f.left && f.right)),
		[insertFragments]
	)
	useEffect(() => {
		setVectorChoice(null)
		setInsertChoice(null)
		setOrientation(0)
	}, [vector.seq, insert.seq, selected])

	const vectorIndex = vectorChoice ?? autoVector
	const insertIndex = insertChoice ?? autoInsert
	const backbone = vectorFragments[vectorIndex]
	const piece = insertFragments[insertIndex]
	const products = useMemo(() => (backbone && piece ? ligate(backbone, piece) : []), [backbone, piece])
	const product = editing ? undefined : products[Math.min(orientation, products.length - 1)]

	const warnings: string[] = []
	const invalid = [...new Set(editing ? sequence.invalid : [...vector.invalid, ...insert.invalid])]
	if (invalid.length) warnings.push(labels.warnings.invalid(invalid.join(' ')))
	if (!editing) {
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
	}

	const resultName = editing ? sequence.name : product ? `${vector.name}-${insert.name}` : vector.name
	const resultSeq = editing ? sequence.seq : (product?.seq ?? vector.seq)
	const resultFasta = resultSeq ? toFasta(resultName, resultSeq, `circular ${resultSeq.length} ${labels.bp}`) : ''

	const regions: Region[] = useMemo(
		() =>
			product
				? [
						{ kind: 'vector', start: 0, end: product.vectorLength },
						{ kind: 'insert', start: product.vectorLength, end: product.seq.length }
					]
				: editing
					? editRegions.filter((region) => region.end <= resultSeq.length)
					: [{ kind: 'vector', start: 0, end: resultSeq.length }],
		[product, resultSeq.length, editing, editRegions]
	)
	const sites: Site[] = useMemo(
		() => chosen.flatMap((enzyme) => findSites(resultSeq, enzyme, true)),
		[chosen, resultSeq]
	)
	useEffect(() => setRange(null), [resultSeq])

	const select = (next: SeqRange | null, source: RangeSource) => {
		setRange((current) =>
			current && next && current.start === next.start && current.end === next.end ? current : next
		)
		setRangeSource(source)
	}

	const selectionLength = range
		? range.start <= range.end
			? range.end - range.start
			: resultSeq.length - range.start + range.end
		: 0
	const selectedSeq = range
		? range.start <= range.end
			? resultSeq.slice(range.start, range.end)
			: resultSeq.slice(range.start) + resultSeq.slice(0, range.end)
		: ''

	const genbank = () => {
		const features: Feature[] = [
			...regions
				.filter((region) => product || editing)
				.map((region) => ({
					type: 'misc_feature',
					start: region.start,
					end: region.end,
					strand: region.kind === 'insert' ? (editing ? insertDirection : product?.orientation === 'reverse' ? -1 : 1) : (1 as 1 | -1),
					label: region.kind === 'insert' ? insert.name : vector.name,
					note: region.kind === 'insert' ? 'insert' : 'vector backbone'
				})),
			...sites.map((site) => ({
				type: 'misc_feature',
				start: site.start,
				end: (site.start + site.length) % resultSeq.length,
				strand: site.strand,
				label: site.enzyme,
				note: 'restriction site'
			}))
		]
		return toGenBank(resultName, resultSeq, features, {
			definition: product
				? `${insert.name} cloned into ${vector.name} (${chosen.map((e) => e.name).join(', ')}).`
				: `${resultName}.`
		})
	}

	/** Edit a copy of what is on screen; the cloning inputs stay untouched. */
	const editResult = () => {
		setEditRegions(resultSeq ? regions : [])
		setInsertDirection(product?.orientation === 'reverse' ? -1 : 1)
		setSequenceTextRaw(resultSeq ? toFasta(resultName, resultSeq) : '>sequence\n')
		setMode('sequence')
	}
	const backToCloning = () => setMode('clone')
	/** Reverse-complements the edited sequence, mirroring its regions and insert direction. */
	const reverseEdit = (columns: number) => {
		const parsed = parseSequence(sequenceText, 'sequence')
		const length = parsed.seq.length
		setEditRegions((current) =>
			current.map((region) => ({ ...region, start: length - region.end, end: length - region.start }))
		)
		setInsertDirection((direction) => (direction === 1 ? -1 : 1))
		setSequenceTextRaw(toFasta(parsed.name, reverseComplement(parsed.seq), '', columns))
	}

	const loadExample = () => {
		setVectorText(fastaOf(exampleVector.name, exampleVector.seq))
		setInsertText(fastaOf(exampleInsert.name, exampleInsert.seq))
		setSelected(exampleEnzymes)
	}

	const toggle = (name: string) =>
		setSelected((current) =>
			current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
		)

	return {
		vectorText,
		setVectorText,
		insertText,
		setInsertText,
		vector,
		insert,
		selected,
		setSelected,
		toggle,
		custom,
		saveCustom,
		byName,
		chosen,
		counts,
		options,
		supplier,
		setSupplier,
		filter,
		setFilter,
		vectorFragments,
		insertFragments,
		vectorIndex,
		insertIndex,
		setVectorChoice,
		setInsertChoice,
		products,
		product,
		orientation,
		setOrientation,
		warnings,
		resultName,
		resultSeq,
		resultFasta,
		regions,
		sites,
		range,
		rangeSource,
		select,
		selectionLength,
		selectedSeq,
		genbank,
		loadExample,
		mode,
		editing,
		sequenceText,
		setSequenceText,
		sequence,
		insertDirection,
		reverseEdit,
		editResult,
		backToCloning
	}
}
