'use client';

import { useEffect, useState } from 'react';
import { requests } from '@/utils/requests';

/**
 * TownFacet
 *
 * Fetches all town-location records and renders them as a multi-select checkbox
 * list. Calls `onChange` with the updated array of selected IDs whenever the
 * selection changes.
 *
 * Props:
 *   selectedIds  – number[]   currently selected town-location IDs (controlled)
 *   onChange     – (ids: number[]) => void  called when selection changes
 *   nameField    – string     field on the town-location object that holds the
 *                             display name (default: "name")
 */
export default function TownFacet({ selectedIds = [], onChange, nameField = 'town' }) {
  const [towns, setTowns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchTowns = async () => {
      try {
        setIsLoading(true);
        const response = await requests.townLocations.listAll(
          {
            filters: {
              addresses: {
                id: { $notNull: true },
              },
            },
            populate: 'addresses',
          },
          { pageSize: 100 }
        );
        const sorted = (response?.data ?? []).sort((a, b) => {
          const aName = String(a[nameField] ?? a.id);
          const bName = String(b[nameField] ?? b.id);
          return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
        });
        
        const uniqueTowns = sorted.filter((town, index, self) => {
          const id = town.id;
          return self.findIndex((t) => t.id === id) === index;
        });

        setTowns(uniqueTowns);

      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error loading town filters.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTowns();
    // nameField is intentionally stable — don't re-fetch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          Town / City
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
      ) : towns.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No towns available.</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto">
          {towns.map((town) => {
            const id = town.id;
            const key = town.documentId; 
            const label = String(town[nameField] ?? id);
            const checked = selectedSet.has(id);

            return (
              <li key={key}>
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
                    ({town.addresses?.length ?? 0})
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
