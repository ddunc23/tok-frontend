'use client';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function SurnameFacet({ value = '', onChange }) {
	return (
		<div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
			<button
				type="button"
				onClick={() => onChange?.('')}
				className={[
					'rounded border px-2 py-1 text-xs font-medium transition-colors',
					value === ''
						? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
						: 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
				].join(' ')}
			>
				All
			</button>

			{LETTERS.map((letter) => (
				<button
					key={letter}
					type="button"
					onClick={() => onChange?.(letter)}
					className={[
						'rounded border px-2 py-1 text-xs font-medium transition-colors',
						value === letter
							? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
							: 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
					].join(' ')}
				>
					{letter}
				</button>
			))}
		</div>
	);
}