'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * MakerSearchBox
 *
 * A debounced text search input for filtering makers by surname.
 * `onChange` is called with the trimmed query string after the user
 * stops typing for `debounceMs` milliseconds, or immediately on form
 * submit / clear.
 *
 * Props:
 *   value        – string   controlled committed value (from parent state)
 *   onChange     – (query: string) => void
 *   debounceMs   – number   debounce delay in ms (default: 350)
 *   placeholder  – string   input placeholder text
 */
export default function MakerSearchBox({
  value = '',
  onChange,
  debounceMs = 350,
  placeholder = 'Search by name…',
}) {
  const [inputValue, setInputValue] = useState(value);
  const timerRef = useRef(null);

  // Keep local input in sync if the parent resets the value externally
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const commit = (raw) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange?.(raw.trim());
  };

  const handleChange = (event) => {
    const raw = event.target.value;
    setInputValue(raw);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange?.(raw.trim());
    }, debounceMs);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    commit(inputValue);
  };

  const handleClear = () => {
    setInputValue('');
    commit('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <div className="relative flex flex-1 items-center">
        <input
          type="search"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label="Search makers by surname"
          className="w-full rounded border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Search
      </button>
    </form>
  );
}
