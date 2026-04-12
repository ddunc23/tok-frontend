'use client';

import { useMemo, useState } from 'react';

function getNestedValue(item, path) {
	if (!path) return undefined;

	return path.split('.').reduce((value, key) => {
		if (value == null) return undefined;
		return value[key];
	}, item);
}

function compareValues(a, b) {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;

	if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	}

	const aDate = Date.parse(a);
	const bDate = Date.parse(b);
	if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
		return aDate - bDate;
	}

	return String(a).localeCompare(String(b), undefined, {
		numeric: true,
		sensitivity: 'base',
	});
}

export default function TableDisplay({
	data = [],
	columns = [],
	rowKey = 'id',
	emptyMessage = 'No rows to display.',
}) {
	const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

	const normalizedColumns = useMemo(() => {
		return columns.map((column) => {
			if (typeof column === 'string') {
				return {
					key: column,
					header: column,
					sortable: true,
				};
			}

			return {
				key: column.key,
				header: column.header || column.key,
				sortable: column.sortable ?? true,
				render: column.render,
				sortAccessor: column.sortAccessor,
			};
		});
	}, [columns]);

	const sortedRows = useMemo(() => {
		if (!sortConfig.key) return data;

		const column = normalizedColumns.find((col) => col.key === sortConfig.key);
		if (!column) return data;

		const rows = [...data].sort((left, right) => {
			const leftValue = column.sortAccessor
				? column.sortAccessor(left)
				: getNestedValue(left, column.key);
			const rightValue = column.sortAccessor
				? column.sortAccessor(right)
				: getNestedValue(right, column.key);

			const result = compareValues(leftValue, rightValue);
			return sortConfig.direction === 'asc' ? result : -result;
		});

		return rows;
	}, [data, normalizedColumns, sortConfig]);

	const handleSort = (column) => {
		if (!column.sortable) return;

		setSortConfig((current) => {
			if (current.key !== column.key) {
				return { key: column.key, direction: 'asc' };
			}

			return {
				key: column.key,
				direction: current.direction === 'asc' ? 'desc' : 'asc',
			};
		});
	};

	return (
		<div className="w-full overflow-x-auto rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
			<table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
				<thead className="bg-zinc-100 dark:bg-zinc-900">
					<tr>
						{normalizedColumns.map((column) => {
							const isSorted = sortConfig.key === column.key;
							const sortIcon = isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕';

							return (
								<th
									key={column.key}
									scope="col"
									className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-300"
								>
									{column.sortable ? (
										<button
											type="button"
											onClick={() => handleSort(column)}
											className="inline-flex items-center gap-2"
										>
											<span>{column.header}</span>
											<span className="text-[10px]">{sortIcon}</span>
										</button>
									) : (
										<span>{column.header}</span>
									)}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
					{sortedRows.length === 0 ? (
						<tr>
							<td
								colSpan={Math.max(normalizedColumns.length, 1)}
								className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400"
							>
								{emptyMessage}
							</td>
						</tr>
					) : (
						sortedRows.map((row, rowIndex) => {
							const fallbackKey = `${rowIndex}`;
							const keyValue = getNestedValue(row, rowKey);
							const itemKey = keyValue != null ? String(keyValue) : fallbackKey;

							return (
								<tr key={itemKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
									{normalizedColumns.map((column) => {
										const value = getNestedValue(row, column.key);

										return (
											<td key={column.key} className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
												{column.render ? column.render(value, row) : String(value ?? '—')}
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
}
