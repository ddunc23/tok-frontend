'use client';

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useMemo, useState } from 'react';

function normalizeOption(option) {
  const id = option?.id ?? option?.documentId;
  const label = String(option?.label ?? option?.name ?? option?.title ?? id ?? '');
  const count = option?.count;

  return {
    id,
    label,
    count: typeof count === 'number' ? count : null,
  };
}

/**
 * ComboBox
 *
 * Searchable multi-select combobox for facet-style filters.
 *
 * Props:
 * - label: string
 * - options: array of { id, label, count? } or compatible objects
 * - selectedIds: array of selected option ids (controlled)
 * - onChange: function(nextIds)
 * - placeholder: string
 * - noResultsText: string
 */
export default function ComboBox({
  label = 'Filter',
  options = [],
  selectedIds = [],
  onChange,
  placeholder = 'Search options...',
  noResultsText = 'No matches found.',
}) {
  const [query, setQuery] = useState('');

  const normalizedOptions = useMemo(
    () => options.map(normalizeOption).filter((option) => option.id !== undefined && option.id !== null),
    [options]
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = useMemo(
    () => normalizedOptions.filter((option) => selectedIdSet.has(option.id)),
    [normalizedOptions, selectedIdSet]
  );

  const filteredOptions = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return normalizedOptions;
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(lowered));
  }, [normalizedOptions, query]);

  const selectedValue = selectedOptions;

  const handleSelectionChange = (nextSelectedOptions) => {
    const nextIds = (nextSelectedOptions ?? []).map((option) => option.id);
    onChange?.(nextIds);
  };

  const handleRemoveChip = (idToRemove) => {
    onChange?.(selectedIds.filter((id) => id !== idToRemove));
  };

  const handleClearAll = () => onChange?.([]);

  return (
    <Combobox as="div" multiple value={selectedValue} onChange={handleSelectionChange}>
      <div className="flex items-center justify-between gap-3">
        <Label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </Label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative mt-2">
        <ComboboxInput
          className="block w-full rounded-md border border-zinc-300 bg-white py-2 pr-10 pl-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setQuery('')}
          displayValue={() => query}
          placeholder={placeholder}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronDownIcon className="size-5 text-zinc-400" aria-hidden="true" />
        </ComboboxButton>

        <ComboboxOptions
          anchor="bottom"
          transition
          className="z-20 mt-1 max-h-64 w-[var(--input-width)] overflow-auto rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-lg outline-none data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">{noResultsText}</div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selectedIdSet.has(option.id);
              return (
                <ComboboxOption
                  key={option.id}
                  value={option}
                  className="group flex cursor-default items-center justify-between gap-3 rounded px-3 py-2 text-zinc-800 select-none data-focus:bg-zinc-100 dark:text-zinc-100 dark:data-focus:bg-zinc-800"
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {option.count !== null && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">({option.count})</span>
                    )}
                    {isSelected && <CheckIcon className="size-4 text-zinc-700 dark:text-zinc-200" aria-hidden="true" />}
                  </span>
                </ComboboxOption>
              );
            })
          )}
        </ComboboxOptions>
      </div>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <span
              key={`chip-${option.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {option.label}
              <button
                type="button"
                onClick={() => handleRemoveChip(option.id)}
                className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                aria-label={`Remove ${option.label}`}
              >
                <XMarkIcon className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Combobox>
  );
}
