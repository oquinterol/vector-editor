import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VectorEditor, labelsEn, labelsEs } from '../src'
import '../src/ui/styles.css'
import './app.css'

type Lang = 'es' | 'en'

const initialLang = (): Lang => {
	try {
		const stored = localStorage.getItem('vector-editor.lang')
		if (stored === 'es' || stored === 'en') return stored
	} catch {
		/* Storage is optional. */
	}
	return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const copy = {
	es: {
		tagline: 'simulador de clonación',
		source: 'Código abierto (MIT)',
		by: 'Hecho por',
		data: 'Enzimas: REBASE'
	},
	en: {
		tagline: 'cloning simulator',
		source: 'Open source (MIT)',
		by: 'Made by',
		data: 'Enzymes: REBASE'
	}
} as const

function App() {
	const [lang, setLang] = useState<Lang>(initialLang)
	const t = copy[lang]
	useEffect(() => {
		document.documentElement.lang = lang
		try {
			localStorage.setItem('vector-editor.lang', lang)
		} catch {
			/* Storage is optional. */
		}
	}, [lang])

	const brand = (
		<div className='app-brand'>
			<img src='/favicon.svg' alt='' width='22' height='22' />
			<span>
				<strong>Vector Editor</strong> <span className='app-tagline'>{t.tagline}</span>
			</span>
			<div className='app-lang' role='group' aria-label='Language / Idioma'>
				{(['es', 'en'] as const).map((code) => (
					<button key={code} type='button' aria-pressed={lang === code} onClick={() => setLang(code)}>
						{code.toUpperCase()}
					</button>
				))}
			</div>
		</div>
	)

	return (
		<div className='app-shell'>
			<VectorEditor layout='app' labels={lang === 'es' ? labelsEs : labelsEn} brand={brand} />
			<footer className='app-footer'>
				<a href='https://github.com/oquinterol/vector-editor'>{t.source}</a>
				<span aria-hidden='true'>·</span>
				<a href='http://rebase.neb.com'>{t.data}</a>
				<span aria-hidden='true'>·</span>
				<span>
					{t.by} <a href='https://oquinterol.com'>Oscar Quintero — oquinterol.com</a>
				</span>
			</footer>
		</div>
	)
}

createRoot(document.getElementById('root')!).render(<App />)
