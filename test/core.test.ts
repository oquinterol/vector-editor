import { describe, expect, it } from 'vitest'
import {
	commercialEnzymes,
	digest,
	findAllCuts,
	findCuts,
	findSites,
	formatSite,
	fragmentLength,
	leftEnd,
	ligate,
	canSelfLigate,
	parseEnzyme,
	parseSequence,
	reverseComplement,
	rightEnd,
	topStrand,
	toFasta,
	toGenBank,
	type Enzyme,
	type Fragment
} from '../src/core'
import { exampleEnzymes, exampleInsert, exampleVector } from '../src/data/examples'

const enzyme = (name: string): Enzyme => {
	const found = commercialEnzymes.find((e) => e.name === name)
	if (!found) throw new Error(`missing ${name}`)
	return found
}
const EcoRI = enzyme('EcoRI')
const BamHI = enzyme('BamHI')
const largest = (fragments: Fragment[]) =>
	[...fragments].sort((a, b) => fragmentLength(b) - fragmentLength(a))[0]!
const containsCircular = (circle: string, motif: string) =>
	(circle + circle.slice(0, motif.length - 1)).includes(motif)

describe('enzyme catalogue and notation', () => {
	it('loads REBASE commercial enzymes with correct cuts', () => {
		expect(EcoRI).toMatchObject({ site: 'GAATTC', cut: 1, cutComplement: 5 })
		expect(enzyme('KpnI')).toMatchObject({ site: 'GGTACC', cut: 5, cutComplement: 1 })
		expect(enzyme('BsaI')).toMatchObject({ site: 'GGTCTC', cut: 7, cutComplement: 11 })
		expect(commercialEnzymes.length).toBeGreaterThan(400)
	})
	it('parses custom enzymes in REBASE notation', () => {
		expect(parseEnzyme('MyEco', 'G^AATTC')).toMatchObject({ cut: 1, cutComplement: 5, custom: true })
		expect(parseEnzyme('MyEco2', 'g^aatt_c')).toMatchObject({ site: 'GAATTC', cut: 1, cutComplement: 5 })
		expect(parseEnzyme('MyBsa', 'GGTCTC(1/5)')).toMatchObject({ cut: 7, cutComplement: 11 })
		expect(() => parseEnzyme('Bad', 'GAXTTC')).toThrow()
		expect(() => parseEnzyme('NoCut', 'GAATTC')).toThrow()
	})
	it('formats sites back to REBASE notation', () => {
		expect(formatSite(EcoRI)).toBe('G^AATTC')
		expect(formatSite(enzyme('BsaI'))).toBe('GGTCTC(1/5)')
		expect(formatSite(enzyme('SmaI'))).toBe('CCC^GGG')
	})
})

describe('site search', () => {
	it('finds a palindromic site once', () => {
		expect(findCuts('AAAGAATTCAAA', EcoRI, false)).toEqual([
			{ enzyme: 'EcoRI', top: 4, bottom: 8, strand: 1 }
		])
	})
	it('maps cuts on the reverse strand for asymmetric sites', () => {
		// GAGACC is BsaI on the bottom strand; it cuts upstream: N^NNNN_N GAGACC
		const seq = 'AAAAAAAAAA' + 'GAGACC' + 'AAAA'
		expect(findCuts(seq, enzyme('BsaI'), false)).toEqual([
			{ enzyme: 'BsaI', top: 5, bottom: 9, strand: -1 }
		])
	})
	it('finds a site spanning the origin of a circular sequence', () => {
		const circle = 'ATTCCCCCCCCGA'
		expect(findCuts(circle, EcoRI, true)).toEqual([
			{ enzyme: 'EcoRI', top: 12, bottom: 16, strand: 1 }
		])
		expect(findCuts(circle, EcoRI, false)).toEqual([])
	})
	it('locates recognition sites, including across the origin', () => {
		expect(findSites('AAAGAATTCAAA', EcoRI, false)).toEqual([
			{ enzyme: 'EcoRI', start: 3, length: 6, strand: 1 }
		])
		expect(findSites('ATTCCCCCCCCGA', EcoRI, true)).toEqual([
			{ enzyme: 'EcoRI', start: 11, length: 6, strand: 1 }
		])
		expect(findSites('AAAAGAGACCAA', enzyme('BsaI'), false)).toEqual([
			{ enzyme: 'BsaI', start: 4, length: 6, strand: -1 }
		])
	})
	it('reads ambiguous IUPAC sites', () => {
		const custom = parseEnzyme('Ambi', 'GR^CGYC')
		expect(findCuts('TTGACGTCTT', custom, false)).toHaveLength(1)
	})
})

describe('digestion', () => {
	it('splits a linear sequence and reports sticky ends', () => {
		const [left, right] = digest('AAAGAATTCAAA', findCuts('AAAGAATTCAAA', EcoRI, false), false)
		expect(topStrand(left!)).toBe('AAAG')
		expect(rightEnd(left!)).toMatchObject({ type: '5prime', overhang: 'AATT' })
		expect(leftEnd(right!)).toMatchObject({ type: '5prime', overhang: 'AATT' })
		expect(leftEnd(left!).type).toBe('none')
	})
	it('reports 3prime and blunt ends', () => {
		const kpn = digest('AAGGTACCAA', findCuts('AAGGTACCAA', enzyme('KpnI'), false), false)
		expect(leftEnd(kpn[1]!)).toMatchObject({ type: '3prime', overhang: 'GTAC' })
		const sma = digest('AACCCGGGAA', findCuts('AACCCGGGAA', enzyme('SmaI'), false), false)
		expect(leftEnd(sma[1]!)).toMatchObject({ type: 'blunt', overhang: '' })
	})
	it('linearises a circle cut once across the origin', () => {
		const circle = 'ATTCCCCCCCCGA'
		const [linear] = digest(circle, findCuts(circle, EcoRI, true), true)
		expect(fragmentLength(linear!)).toBe(circle.length)
		expect(topStrand(linear!)).toBe('AATTCCCCCCCCG')
		expect(canSelfLigate(linear!)).toBe(true)
	})
})

describe('ligation', () => {
	const vector = 'CCCCCCCCCC' + 'GAATTC' + 'TTTT' + 'GGATCC' + 'CCCCCCCCCC'
	const insert = 'AA' + 'GAATTC' + 'GGGGGG' + 'GGATCC' + 'AA'
	const backbone = largest(digest(vector, findAllCuts(vector, [EcoRI, BamHI], true), true))
	const middle = digest(insert, findAllCuts(insert, [EcoRI, BamHI], false), false)[1]!

	it('clones directionally with two enzymes', () => {
		const products = ligate(backbone, middle)
		expect(products).toHaveLength(1)
		expect(products[0]!.orientation).toBe('forward')
		expect(containsCircular(products[0]!.seq, 'GAATTCGGGGGGGGATCC')).toBe(true)
		expect(products[0]!.seq).toHaveLength(products[0]!.vectorLength + products[0]!.insertLength)
	})
	it('allows both orientations with a single enzyme', () => {
		const v = largest(digest(vector, findCuts(vector, EcoRI, true), true))
		const i = digest('AAGAATTCGGGGGAATTCAA', findCuts('AAGAATTCGGGGGAATTCAA', EcoRI, false), false)[1]!
		expect(ligate(v, i).map((p) => p.orientation)).toEqual(['forward', 'reverse'])
	})
	it('rejects incompatible ends', () => {
		const v = largest(digest(vector, findCuts(vector, EcoRI, true), true))
		const i = digest(insert, findCuts(insert, BamHI, false), false)[0]!
		expect(ligate(v, i)).toEqual([])
	})
	it('clones the real StSP6A example into pUC19 with KpnI and XbaI', () => {
		const enzymes = exampleEnzymes.map(enzyme)
		const v = largest(digest(exampleVector.seq, findAllCuts(exampleVector.seq, enzymes, true), true))
		const fragments = digest(exampleInsert.seq, findAllCuts(exampleInsert.seq, enzymes, false), false)
		expect(fragments).toHaveLength(3)
		const products = ligate(v, fragments[1]!)
		expect(products).toHaveLength(1)
		const cds = exampleInsert.seq.slice(8, -8)
		const product = products[0]!.seq
		expect(containsCircular(product, cds) || containsCircular(product, reverseComplement(cds))).toBe(true)
	})
	it('shows that EcoRI/BamHI would cut inside StSP6A', () => {
		const cuts = findAllCuts(exampleInsert.seq, [EcoRI, BamHI], false)
		expect(cuts).toHaveLength(2)
	})
})

describe('FASTA', () => {
	it('parses the first record and flags invalid characters', () => {
		const parsed = parseSequence('>my_seq desc\nACGT acgu\n12 NNX\n>second\nAAAA')
		expect(parsed).toEqual({ name: 'my_seq', seq: 'ACGTACGTNN', invalid: ['X'] })
	})
	it('wraps sequences at 70 columns', () => {
		const fasta = toFasta('p', 'A'.repeat(150), 'circular')
		expect(fasta.split('\n')).toEqual(['>p circular', 'A'.repeat(70), 'A'.repeat(70), 'A'.repeat(10), ''])
	})
})

describe('GenBank', () => {
	const gb = toGenBank(
		'my plasmid',
		'ACGT'.repeat(20),
		[
			{ type: 'misc_feature', start: 0, end: 70, strand: 1, label: 'backbone', note: 'vector' },
			{ type: 'misc_feature', start: 70, end: 10, strand: -1, label: 'insert' }
		],
		{ date: new Date(Date.UTC(2026, 9, 3)) }
	)
	const lines = gb.split('\n')
	it('writes a LOCUS line with length, topology and date', () => {
		expect(lines[0]).toBe('LOCUS       my_plasmid                80 bp    DNA     circular SYN 03-OCT-2026')
	})
	it('writes features, including complement and origin-spanning joins', () => {
		expect(gb).toContain('     misc_feature    1..70\n                     /label="backbone"\n                     /note="vector"')
		expect(gb).toContain('     misc_feature    complement(join(71..80,1..10))')
	})
	it('writes ORIGIN in numbered blocks of ten and ends with //', () => {
		expect(gb).toContain('        1 acgtacgtac gtacgtacgt acgtacgtac gtacgtacgt acgtacgtac gtacgtacgt\n       61 acgtacgtac gtacgtacgt')
		expect(lines.at(-2)).toBe('//')
	})
})
