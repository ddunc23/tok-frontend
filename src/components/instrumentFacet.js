'use client';

import { useMemo } from 'react';
import ComboBox from '@/components/comboBox';

export default function InstrumentFacet({
  selectedIds = [],
  onChange,
  counts = {},
  options: instrumentOptions = null,
}) {

  const facetOptions = useMemo(
    () =>
      (instrumentOptions ?? [])
        .filter((term) => {
          const id = Number(term.id);
          return counts[id] !== undefined && counts[id] > 0;
        })
        .map((term) => {
          const id = Number(term.id);
          return {
            id,
            label: String(term.label ?? `Instrument #${id}`),
            count: counts[id] ?? 0,
            searchText: String(term.searchText ?? term.label ?? `Instrument #${id}`),
          };
        }),
    [instrumentOptions, counts]
  );

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col gap-3">
      {instrumentOptions === null ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : facetOptions.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No instruments available.</p>
      ) : (
        <ComboBox
          label="Instrument"
          options={facetOptions}
          selectedIds={selectedIds}
          onChange={onChange}
          placeholder="Search instruments..."
          noResultsText="No matching instruments."
        />
      )}
    </aside>
  );
}