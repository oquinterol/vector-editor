import React, { useId, useMemo, useState } from 'react'
import { formatSite, type Enzyme } from '../core'
import type { Labels } from './labels'

interface Props {
	options: Enzyme[]
	counts: Map<string, { vector: number; insert: number }>
	selected: string[]
	onToggle: (name: string) => void
	labels: Labels
}

const MAX_OPTIONS = 60

/** Searchable, keyboard-friendly multi-select for enzymes (ARIA combobox pattern). */
export function EnzymeCombobox({ options, counts, selected, onToggle, labels }: Props) {
	const id = useId()
	const listId = `${id}-list`
	const [query, setQuery] = useState('')
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(0)

	const matches = useMemo(() => {
		const q = query.trim().toUpperCase()
		const scored = options
			.filter((e) => !q || e.name.toUpperCase().includes(q) || e.site.includes(q))
			.map((e) => ({ e, score: !q ? 0 : e.name.toUpperCase().startsWith(q) ? 0 : 1 }))
		scored.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name))
		return scored.slice(0, MAX_OPTIONS).map((s) => s.e)
	}, [options, query])

	const current = matches[Math.min(active, matches.length - 1)]
	const optionId = (name: string) => `${id}-${name.replace(/[^\w-]/g, '_')}`

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setOpen(true)
			setActive((i) => Math.min(i + 1, matches.length - 1))
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActive((i) => Math.max(i - 1, 0))
		} else if (event.key === 'Enter' && open && current) {
			event.preventDefault()
			onToggle(current.name)
		} else if (event.key === 'Escape') {
			setOpen(false)
		}
	}

	return (
		<div className='ve-combobox'>
			<input
				type='text'
				role='combobox'
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete='list'
				aria-activedescendant={open && current ? optionId(current.name) : undefined}
				aria-label={labels.search}
				placeholder={labels.search}
				value={query}
				onChange={(event) => {
					setQuery(event.target.value)
					setActive(0)
					setOpen(true)
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={onKeyDown}
			/>
			{open && (
				<ul id={listId} role='listbox' aria-multiselectable='true' className='ve-listbox'>
					{matches.length === 0 && <li className='ve-muted ve-empty'>{labels.noMatches}</li>}
					{matches.map((enzyme, index) => {
						const count = counts.get(enzyme.name)
						const isSelected = selected.includes(enzyme.name)
						return (
							<li
								key={enzyme.name}
								id={optionId(enzyme.name)}
								role='option'
								aria-selected={isSelected}
								className={index === active ? 'is-active' : undefined}
								// Keep focus in the input so several enzymes can be picked in a row.
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActive(index)}
								onClick={() => onToggle(enzyme.name)}
							>
								<span className='ve-check' aria-hidden='true'>
									{isSelected ? '✓' : ''}
								</span>
								<strong>{enzyme.name}</strong>
								<code>{formatSite(enzyme)}</code>
								<span className='ve-muted'>
									V {count?.vector ?? 0} · I {count?.insert ?? 0}
								</span>
								{enzyme.custom && <span className='ve-tag'>{labels.custom}</span>}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
