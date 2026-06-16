'use client';

import { useState } from 'react';

/**
 * DateFacet
 *
 * Renders two year-only inputs that let the user specify an activity range.
 * The intent is "show makers who were active during this period", so:
 *   - `from` constrains  date_1 >= from  (maker started no earlier than)
 *   - `to`   constrains  date_2 <= to    (maker ended no later than)
 *
 * Either bound is optional; only the set bounds are sent as filters.
 *
 * Props:
 *   dateRange  – { from: string, to: string }  controlled value
 *   onChange   – (range: { from: string, to: string }) => void
 */
export default function DateFacet({ dateRange = { from: '', to: '' }, onChange }) {
  const normalizeYear = (value) => {
    if (!value) return '';
    const year = String(value).slice(0, 4);
    return /^\d{4}$/.test(year) ? year : '';
  };

  const toIsoDate = (year) => {
    if (!year) return '';
    return `${year}-01-01`;
  };

  const [fromInput, setFromInput] = useState(normalizeYear(dateRange.from ?? ''));
  const [toInput, setToInput] = useState(normalizeYear(dateRange.to ?? ''));

  const isActive = fromInput !== '' || toInput !== '';

  const commit = (nextFrom, nextTo) => {
    onChange?.({ from: toIsoDate(nextFrom), to: toIsoDate(nextTo) });
  };

  const handleFromBlur = () => commit(fromInput, toInput);
  const handleToBlur = () => commit(fromInput, toInput);

  const handleFromKeyDown = (event) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  const handleToKeyDown = (event) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  const handleClear = () => {
    setFromInput('');
    setToInput('');
    commit('', '');
  };

  const inputClass =
    'w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 ' +
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ' +
    'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Date Range
        </h2>
        {isActive && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">From year</label>
          <input
            type="number"
            min="1000"
            max="9999"
            placeholder="1840"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            onBlur={handleFromBlur}
            onKeyDown={handleFromKeyDown}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">To year</label>
          <input
            type="number"
            min="1000"
            max="9999"
            placeholder="1720"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            onBlur={handleToBlur}
            onKeyDown={handleToKeyDown}
            className={inputClass}
          />
        </div>
      </div>
    </aside>
  );
}
