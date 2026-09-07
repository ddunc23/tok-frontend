'use client';

import { useEffect, useState } from 'react';
import ComboBox from '@/components/comboBox';
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
export default function TownFacet({ selectedIds = [], onChange, nameField = 'town', counts = {} }) {
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

  const options = towns
    .filter((town) => {
      const id = town.id;
      return counts[id] !== undefined && counts[id] > 0;
    })
    .map((town) => {
      const id = town.id;
      return {
        id,
        label: String(town[nameField] ?? id),
        count: counts[id] ?? 0,
      };
    });

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col gap-3">
      {errorMessage ? (
        <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
      ) : isLoading ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : towns.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No towns available.</p>
      ) : (
        <ComboBox
          label="Town / City"
          options={options}
          selectedIds={selectedIds}
          onChange={onChange}
          placeholder="Search towns..."
          noResultsText="No matching towns."
        />
      )}
    </aside>
  );
}
