'use client';

import { useEffect, useState } from 'react';
import { requests } from '@/utils/requests';

export default function GuildFacet({ selectedIds = [], onChange, nameField = 'name' }) {
	const [guilds, setGuilds] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		const fetchGuilds = async () => {
			try {
				setIsLoading(true);
				const response = await requests.guilds.listAll(
					{
						filters: {
							memberships: {
								id: { $notNull: true },
							},
						},
							populate: 'memberships',
					},
					{ pageSize: 100 }
				);
				const sorted = (response?.data ?? []).sort((a, b) => {
					const aName = String(a[nameField] ?? a.id);
					const bName = String(b[nameField] ?? b.id);
					return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
				});
				setGuilds(sorted);
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : 'Error loading guild filters.');
			} finally {
				setIsLoading(false);
			}
		};

		fetchGuilds();
	}, [nameField]);

	const selectedSet = new Set(selectedIds);

	const handleToggle = (id) => {
		const next = new Set(selectedSet);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		onChange?.(Array.from(next));
	};

	const handleClear = () => onChange?.([]);

	return (
		<aside className="flex w-56 flex-shrink-0 flex-col gap-3">
			<div className="flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
					Guild
				</h2>
				{selectedSet.size > 0 && (
					<button
						type="button"
						onClick={handleClear}
						className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
					>
						Clear
					</button>
				)}
			</div>

			{errorMessage ? (
				<p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
			) : isLoading ? (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>
			) : guilds.length === 0 ? (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">No guilds available.</p>
			) : (
				<ul className="max-h-[60vh] overflow-y-auto">
					{guilds.map((guild) => {
						const id = guild.documentId;
						const label = String(guild[nameField] ?? id);
						const checked = selectedSet.has(id);

						return (
							<li key={id}>
								<label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60">
									<span className="flex items-center gap-2">
										<input
											type="checkbox"
											checked={checked}
											onChange={() => handleToggle(id)}
											className="h-4 w-4 rounded border-zinc-400 accent-zinc-700 dark:accent-zinc-300"
										/>
										{label}
									</span>
									<span className="ml-auto flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
										({guild.memberships?.length ?? 0})
									</span>
								</label>
							</li>
						);
					})}
				</ul>
			)}
		</aside>
	);
}
