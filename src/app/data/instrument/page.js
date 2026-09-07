'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TableDisplay from '@/components/tableDisplay';
import InstrumentVocabularyGraph from '@/components/instrumentVocabularyGraph';

function Instruments() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState([]);
  const [instrumentOptions, setInstrumentOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageSize] = useState(25);
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const pageRaw = searchParams.get('page') ?? '1';
    const parsedPage = Number.parseInt(pageRaw, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    setQuery(q);
    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setIsHydratedFromQuery(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const nextParams = new URLSearchParams(searchParams.toString());

    if (query) nextParams.set('q', query);
    else nextParams.delete('q');

    if (currentPage > 1) nextParams.set('page', String(currentPage));
    else nextParams.delete('page');

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [currentPage, isHydratedFromQuery, pathname, query, router, searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const fetchInstruments = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'}/api/maker-extendeds/facet-counts?filters=${encodeURIComponent(JSON.stringify({}))}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch instruments: ${response.statusText}`);
        }

        const payload = await response.json();
        const options = payload?.instrumentOptions ?? [];

        const nextRows = options.map((entry) => ({
          termId: entry?.id,
          preferredLabel: entry?.label ?? `Instrument #${entry?.id ?? 'unknown'}`,
          termCode: entry?.termCode ?? null,
          total: entry?.count ?? 0,
          known: entry?.knownCount ?? 0,
          advertised: entry?.advertisedCount ?? 0,
        }));

        setInstrumentOptions(options);
        setRows(nextRows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching instruments.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstruments();
  }, [isHydratedFromQuery]);

  const filteredRows = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return rows;
    return rows.filter((row) => row.preferredLabel.toLowerCase().includes(lowered));
  }, [query, rows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pagedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safeCurrentPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
      setPageInput(String(safeCurrentPage));
    }
  }, [currentPage, safeCurrentPage]);

  const columns = useMemo(
    () => [
      { key: 'preferredLabel', header: 'Instrument' },
      { key: 'total', header: 'Total Makers' },
      { key: 'known', header: 'Known' },
      { key: 'advertised', header: 'Advertised' },
      {
        key: 'termId',
        header: 'Record',
        sortable: false,
        render: (_value, row) => (
          <Link
            href={`/data/instrument/detail?id=${row.termId}`}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            View
          </Link>
        ),
      },
    ],
    []
  );

  const handlePageSubmit = (event) => {
    event.preventDefault();

    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(safeCurrentPage));
      return;
    }

    const nextPage = Math.min(Math.max(parsed, 1), pageCount);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">Instruments</h1>
          <div className="flex gap-1">
            {[
              { id: 'list', label: 'List' },
              { id: 'network', label: 'Vocabulary Network' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-lg">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Search Instruments
          </label>
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
              setPageInput('1');
            }}
            placeholder="Type an instrument name..."
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-zinc-600 dark:text-zinc-300">Loading instruments...</p>
        ) : activeTab === 'network' ? (
          <InstrumentVocabularyGraph instrumentOptions={instrumentOptions} />
        ) : (
          <>
            <TableDisplay
              data={pagedRows}
              columns={columns}
              rowKey="termId"
              emptyMessage="No instruments found."
            />

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Page {safeCurrentPage} of {pageCount} ({filteredRows.length} total)
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1 || isLoading}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  disabled={safeCurrentPage >= pageCount || isLoading}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Next
                </button>
                <form onSubmit={handlePageSubmit} className="ml-2 flex items-center gap-2">
                  <label htmlFor="instrument-page-input" className="text-sm text-zinc-600 dark:text-zinc-300">
                    Go to
                  </label>
                  <input
                    id="instrument-page-input"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function InstrumentsPage() {
  return (
    <Suspense>
      <Instruments />
    </Suspense>
  );
}
