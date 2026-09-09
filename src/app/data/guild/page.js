'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import GuildResultsNetwork from '@/components/guildResultsNetwork';
import TableDisplay from '@/components/tableDisplay';
import { requests } from '@/utils/requests';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];
const DEFAULT_PAGE_SIZE = 25;

function Guilds() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const pageRaw = searchParams.get('page') ?? '1';
    const pageSizeRaw = searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE);

    const parsedPage = Number.parseInt(pageRaw, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    const parsedPageSize = Number.parseInt(pageSizeRaw, 10);
    const safePageSize = PAGE_SIZE_OPTIONS.includes(parsedPageSize) ? parsedPageSize : DEFAULT_PAGE_SIZE;

    setQuery(q);
    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setPageSize(safePageSize);
    setIsHydratedFromQuery(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const nextParams = new URLSearchParams(searchParams.toString());

    if (query) nextParams.set('q', query);
    else nextParams.delete('q');

    if (currentPage > 1) nextParams.set('page', String(currentPage));
    else nextParams.delete('page');

    if (pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(pageSize));
    else nextParams.delete('pageSize');

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [currentPage, isHydratedFromQuery, pageSize, pathname, query, router, searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const fetchGuilds = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const response = await requests.guilds.listAll(
          {
            sort: ['name:asc'],
            populate: {
              memberships: true,
            },
          },
          { pageSize: 200 }
        );

        const nextRows = (response?.data ?? []).map((guild) => {
          const memberships = Array.isArray(guild?.memberships) ? guild.memberships : [];
          const uniqueMakerCount = new Set(
            memberships
              .map((membership) =>
                String(
                  membership?.maker_extended?.documentId ??
                    membership?.maker_extended?.id ??
                    membership?.maker_id ??
                    ''
                )
              )
              .filter(Boolean)
          ).size;

          return {
            documentId: guild?.documentId,
            id: guild?.id,
            guildId: guild?.guild_id ?? null,
            name: guild?.name ?? `Guild #${guild?.id ?? 'unknown'}`,
            membershipCount: memberships.length,
            uniqueMakerCount,
          };
        });

        setRows(nextRows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching guilds.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuilds();
  }, [isHydratedFromQuery]);

  const filteredRows = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return rows;

    return rows.filter((row) => {
      const nameMatch = String(row?.name ?? '').toLowerCase().includes(lowered);
      const idMatch = String(row?.guildId ?? '').toLowerCase().includes(lowered);
      return nameMatch || idMatch;
    });
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
      { key: 'name', header: 'Guild' },
      { key: 'guildId', header: 'Guild ID' },
      { key: 'membershipCount', header: 'Membership Rows' },
      { key: 'uniqueMakerCount', header: 'Unique Makers' },
      {
        key: 'documentId',
        header: 'Record',
        sortable: false,
        render: (_value, row) => (
          <Link
            href={`/data/guild/detail?id=${row.documentId ?? row.id}`}
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

  const handlePageSizeChange = (nextSize) => {
    if (!PAGE_SIZE_OPTIONS.includes(nextSize) || nextSize === pageSize) return;
    setPageSize(nextSize);
    setCurrentPage(1);
    setPageInput('1');
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">Guilds</h1>
          <div className="flex gap-1">
            {[
              { id: 'list', label: 'List' },
              { id: 'network', label: 'Network' },
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
            Search Guilds
          </label>
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
              setPageInput('1');
            }}
            placeholder="Type a guild name or id..."
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-zinc-600 dark:text-zinc-300">Loading guilds...</p>
        ) : activeTab === 'network' ? (
          <GuildResultsNetwork guilds={filteredRows} />
        ) : (
          <>
            <TableDisplay
              data={pagedRows}
              columns={columns}
              rowKey="documentId"
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
              emptyMessage="No guilds found."
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
                  <label htmlFor="guild-page-input" className="text-sm text-zinc-600 dark:text-zinc-300">
                    Go to
                  </label>
                  <input
                    id="guild-page-input"
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

export default function GuildsPage() {
  return (
    <Suspense>
      <Guilds />
    </Suspense>
  );
}
