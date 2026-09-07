'use client';

import { useEffect, useState } from 'react';
import ComboBox from '@/components/comboBox';
import { requests } from '@/utils/requests';

export default function GuildFacet({ selectedIds = [], onChange, nameField = 'name', counts = {} }) {
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

	const options = guilds
		.filter((guild) => {
			const id = guild.documentId;
			return counts[id] !== undefined && counts[id] > 0;
		})
		.map((guild) => {
			const id = guild.documentId;
			return {
				id,
				label: String(guild[nameField] ?? id),
				count: counts[id] ?? 0,
			};
		});

	return (
		<aside className="flex w-56 flex-shrink-0 flex-col gap-3">
			{errorMessage ? (
				<p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
			) : isLoading ? (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>
			) : guilds.length === 0 ? (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">No guilds available.</p>
			) : (
				<ComboBox
					label="Guild"
					options={options}
					selectedIds={selectedIds}
					onChange={onChange}
					placeholder="Search guilds..."
					noResultsText="No matching guilds."
				/>
			)}
		</aside>
	);
}
