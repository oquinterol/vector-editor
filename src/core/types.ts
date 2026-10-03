export interface Enzyme {
	name: string
	/** Recognition site, 5'→3', IUPAC letters. */
	site: string
	/** Top-strand cut: boundary after this residue (1-based in the site; may exceed its length). */
	cut: number
	/** Bottom-strand cut, in top-strand coordinates, same convention. */
	cutComplement: number
	/** REBASE supplier codes; empty for custom enzymes. */
	suppliers: string[]
	custom?: boolean
}

/** A recognition site occurrence: `start` is 0-based on the top strand; may wrap a circle. */
export interface Site {
	enzyme: string
	start: number
	length: number
	strand: 1 | -1
}

/** A double-strand break. Positions are boundaries between bases (0…length). */
export interface Cut {
	enzyme: string
	/** Top-strand cut boundary. */
	top: number
	/** Bottom-strand cut boundary, in top-strand coordinates. */
	bottom: number
	/** Strand on which the recognition site was found. */
	strand: 1 | -1
}

export type EndType = 'blunt' | '5prime' | '3prime' | 'none'

export interface End {
	type: EndType
	/** Single-stranded overhang, written with top-strand letters. */
	overhang: string
	enzyme?: string
}

/**
 * A linear double-stranded fragment. `seq` spans both strands; the offsets mark
 * where each strand starts and ends inside it.
 */
export interface Fragment {
	seq: string
	topStart: number
	topEnd: number
	botStart: number
	botEnd: number
	left?: Cut
	right?: Cut
	/** Top-strand start in the source sequence (for display). */
	sourceStart: number
}

export interface Product {
	seq: string
	orientation: 'forward' | 'reverse'
	vectorLength: number
	insertLength: number
}
