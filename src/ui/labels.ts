export interface Labels {
	vector: string
	insert: string
	pasteHint: string
	upload: string
	loadExample: string
	clear: string
	circular: string
	linear: string
	enzymes: string
	search: string
	supplier: string
	anySupplier: string
	show: string
	showCutsBoth: string
	showCutsVector: string
	showAll: string
	cutsVector: string
	cutsInsert: string
	custom: string
	customName: string
	customSite: string
	customHint: string
	add: string
	remove: string
	selected: string
	none: string
	fragments: string
	vectorFragment: string
	insertFragment: string
	ends: string
	blunt: string
	fivePrime: string
	threePrime: string
	noEnd: string
	orientation: string
	forward: string
	reverse: string
	result: string
	product: string
	copy: string
	copied: string
	download: string
	map: string
	bp: string
	noMatches: string
	legend: string
	selection: (from: number, to: number, length: number) => string
	selectionHint: string
	copySelection: string
	clearSelection: string
	warnings: {
		invalid: (chars: string) => string
		noVectorCuts: string
		noInsertFragment: string
		incompatible: string
		selfLigation: string
		insertCutsInside: (discardedBp: number) => string
		vectorMultiCut: (name: string, count: number) => string
		showingVector: string
	}
	data: (version: string) => string
	privacy: string
}

export const labelsEs: Labels = {
	vector: 'Vector',
	insert: 'Inserto',
	pasteHint: 'Pega FASTA o secuencia; o carga GenBank, SnapGene o FASTA',
	upload: 'Cargar archivo',
	loadExample: 'Cargar ejemplo',
	clear: 'Limpiar',
	circular: 'Circular',
	linear: 'Lineal',
	enzymes: 'Enzimas',
	search: 'Buscar enzima o sitio (p. ej. EcoRI, GAATTC)',
	supplier: 'Proveedor',
	anySupplier: 'Cualquiera',
	show: 'Mostrar',
	showCutsBoth: 'Cortan vector e inserto',
	showCutsVector: 'Cortan el vector',
	showAll: 'Todas',
	cutsVector: 'cortes en vector',
	cutsInsert: 'cortes en inserto',
	custom: 'Enzima propia',
	customName: 'Nombre',
	customSite: 'Sitio',
	customHint: 'Notación REBASE: G^AATTC · G^AATT_C · GGTCTC(1/5)',
	add: 'Agregar',
	remove: 'Quitar',
	selected: 'Seleccionadas',
	none: 'Ninguna',
	fragments: 'Fragmentos',
	vectorFragment: 'Esqueleto del vector',
	insertFragment: 'Fragmento del inserto',
	ends: 'Extremos',
	blunt: 'romo',
	fivePrime: "5'",
	threePrime: "3'",
	noEnd: 'sin corte',
	orientation: 'Orientación',
	forward: 'Directa',
	reverse: 'Inversa',
	result: 'Resultado',
	product: 'Plásmido resultante',
	copy: 'Copiar FASTA',
	copied: 'Copiado',
	download: 'Descargar .fasta',
	map: 'Mapa',
	bp: 'pb',
	noMatches: 'Sin coincidencias',
	legend: 'Regiones y sitios',
	selection: (from, to, length) => `Selección ${from}–${to} · ${length} pb`,
	selectionHint:
		'Selecciona bases en el FASTA, haz clic en el mapa o en la leyenda para ver dónde está cada región.',
	copySelection: 'Copiar selección',
	clearSelection: 'Quitar selección',
	warnings: {
		invalid: (chars) => `Se ignoraron caracteres no válidos: ${chars}`,
		noVectorCuts: 'Las enzimas elegidas no cortan el vector.',
		noInsertFragment: 'Ningún fragmento del inserto tiene corte en ambos extremos.',
		incompatible: 'Los extremos del vector y del inserto no son compatibles.',
		selfLigation:
			'El vector puede religarse sobre sí mismo (extremos compatibles entre sí): considera desfosforilarlo.',
		insertCutsInside: (bp) =>
			`Se descartan ${bp} pb del inserto: comprueba que las enzimas no corten dentro de la región de interés.`,
		vectorMultiCut: (name, count) => `${name} corta ${count} veces el vector.`,
		showingVector: 'Sin producto de ligación: se muestra el vector.'
	},
	data: (version) => `Enzimas comerciales: REBASE ${version} (rebase.neb.com).`,
	privacy: 'Todo se calcula en tu navegador; las secuencias no se envían a ningún servidor.'
}

export const labelsEn: Labels = {
	vector: 'Vector',
	insert: 'Insert',
	pasteHint: 'Paste FASTA or a raw sequence; or load GenBank, SnapGene or FASTA',
	upload: 'Load file',
	loadExample: 'Load example',
	clear: 'Clear',
	circular: 'Circular',
	linear: 'Linear',
	enzymes: 'Enzymes',
	search: 'Search enzyme or site (e.g. EcoRI, GAATTC)',
	supplier: 'Supplier',
	anySupplier: 'Any',
	show: 'Show',
	showCutsBoth: 'Cut vector and insert',
	showCutsVector: 'Cut the vector',
	showAll: 'All',
	cutsVector: 'cuts in vector',
	cutsInsert: 'cuts in insert',
	custom: 'Custom enzyme',
	customName: 'Name',
	customSite: 'Site',
	customHint: 'REBASE notation: G^AATTC · G^AATT_C · GGTCTC(1/5)',
	add: 'Add',
	remove: 'Remove',
	selected: 'Selected',
	none: 'None',
	fragments: 'Fragments',
	vectorFragment: 'Vector backbone',
	insertFragment: 'Insert fragment',
	ends: 'Ends',
	blunt: 'blunt',
	fivePrime: "5'",
	threePrime: "3'",
	noEnd: 'uncut',
	orientation: 'Orientation',
	forward: 'Forward',
	reverse: 'Reverse',
	result: 'Result',
	product: 'Resulting plasmid',
	copy: 'Copy FASTA',
	copied: 'Copied',
	download: 'Download .fasta',
	map: 'Map',
	bp: 'bp',
	noMatches: 'No matches',
	legend: 'Regions and sites',
	selection: (from, to, length) => `Selection ${from}–${to} · ${length} bp`,
	selectionHint: 'Select bases in the FASTA, or click the map or the legend, to see where each region lies.',
	copySelection: 'Copy selection',
	clearSelection: 'Clear selection',
	warnings: {
		invalid: (chars) => `Ignored invalid characters: ${chars}`,
		noVectorCuts: 'The selected enzymes do not cut the vector.',
		noInsertFragment: 'No insert fragment is cut at both ends.',
		incompatible: 'Vector and insert ends are not compatible.',
		selfLigation:
			'The vector can re-ligate on itself (its ends are compatible): consider dephosphorylating it.',
		insertCutsInside: (bp) =>
			`${bp} bp of the insert are discarded: check the enzymes do not cut inside the region of interest.`,
		vectorMultiCut: (name, count) => `${name} cuts the vector ${count} times.`,
		showingVector: 'No ligation product: showing the vector.'
	},
	data: (version) => `Commercial enzymes: REBASE ${version} (rebase.neb.com).`,
	privacy: 'Everything runs in your browser; sequences are never sent to a server.'
}
