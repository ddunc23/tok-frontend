'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

function parseYear(value) {
  if (!value) return null;
  const year = Number.parseInt(String(value).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function formatYear(year) {
  return Number.isFinite(year) ? String(year) : '—';
}

function getMakerLabel(maker) {
  return (
    maker?.Label ||
    [maker?.First_name ?? maker?.first_name, maker?.Surname ?? maker?.surname].filter(Boolean).join(' ') ||
    maker?.Organisation_Name ||
    `Maker #${maker?.id ?? 'unknown'}`
  );
}

function buildTicks(minYear, maxYear) {
  if (!Number.isFinite(minYear) || !Number.isFinite(maxYear) || maxYear < minYear) return [];

  const span = maxYear - minYear;
  const desiredTickCount = 6;

  let step = 10;
  if (span > 150) step = 50;
  else if (span > 80) step = 25;
  else if (span > 40) step = 10;
  else if (span > 20) step = 5;
  else step = 2;

  const startTick = Math.floor(minYear / step) * step;
  const ticks = [];
  for (let year = startTick; year <= maxYear + step; year += step) {
    if (ticks.length > desiredTickCount * 4) break;
    ticks.push(year);
  }
  return ticks;
}

export default function MakerResultsTimeline({ makers = [] }) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState('start');

  const { rows, undatedCount, minYear, maxYear, ticks } = useMemo(() => {
    const datedRows = [];
    let missingDates = 0;

    for (const maker of Array.isArray(makers) ? makers : []) {
      const startYear = parseYear(maker?.Date_1);
      const endYear = parseYear(maker?.Date_2);

      if (!Number.isFinite(startYear) && !Number.isFinite(endYear)) {
        missingDates += 1;
        continue;
      }

      const normalizedStart = Number.isFinite(startYear) ? startYear : endYear;
      const normalizedEnd = Number.isFinite(endYear) ? endYear : startYear;
      if (!Number.isFinite(normalizedStart) || !Number.isFinite(normalizedEnd)) {
        missingDates += 1;
        continue;
      }

      datedRows.push({
        ...maker,
        makerLabel: getMakerLabel(maker),
        startYear: normalizedStart,
        endYear: normalizedEnd,
        isEstimatedPoint: normalizedStart === normalizedEnd,
      });
    }

    datedRows.sort((left, right) => {
      if (sortBy === 'name') {
        return left.makerLabel.localeCompare(right.makerLabel, undefined, { sensitivity: 'base' });
      }

      if (left.startYear !== right.startYear) return left.startYear - right.startYear;
      if (left.endYear !== right.endYear) return left.endYear - right.endYear;
      return left.makerLabel.localeCompare(right.makerLabel, undefined, { sensitivity: 'base' });
    });

    const years = datedRows.flatMap((row) => [row.startYear, row.endYear]).filter(Number.isFinite);
    const minimum = years.length ? Math.min(...years) : null;
    const maximum = years.length ? Math.max(...years) : null;

    return {
      rows: datedRows,
      undatedCount: missingDates,
      minYear: minimum,
      maxYear: maximum,
      ticks: buildTicks(minimum, maximum),
    };
  }, [makers, sortBy]);

  const timelineRange = Number.isFinite(minYear) && Number.isFinite(maxYear)
    ? Math.max(1, maxYear - minYear)
    : 1;

  const getLeftPercent = (year) => ((year - minYear) / timelineRange) * 100;
  const getWidthPercent = (startYear, endYear) => {
    const span = endYear - startYear;
    if (span <= 0) return 1.2;
    return Math.max(1.2, (span / timelineRange) * 100);
  };

  if (!rows.length) {
    return (
      <div className="rounded border border-zinc-200 bg-white px-4 py-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No dated makers available in the current result set.</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sort
          </span>
          {[
            { id: 'start', label: 'Start year' },
            { id: 'name', label: 'Name' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSortBy(option.id)}
              className={[
                'rounded border px-2 py-1 text-xs font-medium transition-colors',
                sortBy === option.id
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {rows.length} dated maker{rows.length === 1 ? '' : 's'}{undatedCount > 0 ? `, ${undatedCount} undated omitted` : ''}.
        </p>
      </div>

      <div className="overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid grid-cols-[minmax(220px,320px)_minmax(0,1fr)] border-b border-zinc-200 dark:border-zinc-700">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Maker
          </div>
          <div className="relative px-4 py-3">
            <div className="relative h-8">
              {ticks.map((tick) => {
                const left = getLeftPercent(tick);
                return (
                  <div
                    key={tick}
                    className="absolute top-0 h-full"
                    style={{ left: `${left}%` }}
                  >
                    <div className="h-3 border-l border-zinc-300 dark:border-zinc-600" />
                    <span className="absolute top-3 -translate-x-1/2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {tick}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {rows.map((row) => {
            const left = getLeftPercent(row.startYear);
            const width = getWidthPercent(row.startYear, row.endYear);

            return (
              <button
                key={row.documentId ?? row.id}
                type="button"
                onClick={() => router.push(`/data/maker/detail?id=${row.documentId ?? row.id}`)}
                className="grid w-full grid-cols-[minmax(220px,320px)_minmax(0,1fr)] border-b border-zinc-100 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950/50"
              >
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.makerLabel}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatYear(row.startYear)} - {formatYear(row.endYear)}
                  </p>
                </div>
                <div className="relative px-4 py-3">
                  <div className="absolute inset-y-0 left-4 right-4">
                    {ticks.map((tick) => {
                      const tickLeft = getLeftPercent(tick);
                      return (
                        <div
                          key={`${row.documentId ?? row.id}-${tick}`}
                          className="absolute top-0 h-full border-l border-zinc-100 dark:border-zinc-800"
                          style={{ left: `${tickLeft}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="relative h-10">
                    <div
                      className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-teal-600/85 shadow-sm dark:bg-teal-500/85"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    {row.isEstimatedPoint && (
                      <div
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-700 dark:border-zinc-900 dark:bg-teal-400"
                        style={{ left: `${left}%` }}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}