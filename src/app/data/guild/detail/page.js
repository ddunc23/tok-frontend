'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TableDisplay from '@/components/tableDisplay';
import { requests } from '@/utils/requests';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];
const DEFAULT_PAGE_SIZE = 25;

function formatYear(value) {
  if (!value) return '—';
  const text = String(value);
  return text.length >= 4 ? text.slice(0, 4) : text;
}

function GuildDetail() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const id = searchParams.get('id');

  const [guild, setGuild] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [query, setQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
    if (!isHydratedFromQuery || !id) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('id', id);

    if (query) nextParams.set('q', query);
    else nextParams.delete('q');

    if (currentPage > 1) nextParams.set('page', String(currentPage));
    else nextParams.delete('page');

    if (pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(pageSize));
    else nextParams.delete('pageSize');

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [currentPage, id, isHydratedFromQuery, pageSize, pathname, query, router, searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery || !id) return;

    const fetchGuildDetail = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const response = await requests.guilds.get(id, {
          populate: {
            memberships: {
              populate: {
                maker_extended: true,
              },
            },
          },
        });

        const guildData = response?.data ?? null;
        const guildMemberships = Array.isArray(guildData?.memberships) ? guildData.memberships : [];

        setGuild(guildData);
        setMemberships(guildMemberships);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching guild details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuildDetail();
  }, [id, isHydratedFromQuery]);

  const membershipRows = useMemo(() => {
    return memberships.map((membership) => {
      const maker = membership?.maker_extended;
      const makerLabelFromName = [maker?.First_name ?? maker?.first_name, maker?.Surname ?? maker?.surname]
        .filter(Boolean)
        .join(' ');

      return {
        ...membership,
        makerDocumentId: maker?.documentId ?? maker?.id ?? null,
        makerIdDisplay: maker?.Maker_ID ?? maker?.maker_id ?? membership?.maker_id ?? '—',
        makerLabelDisplay:
          (maker?.Label ?? maker?.label ?? makerLabelFromName) ||
          maker?.Organisation_Name ||
          `Maker #${maker?.id ?? 'unknown'}`,
      };
    });
  }, [memberships]);

  const filteredRows = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return membershipRows;

    return membershipRows.filter((row) => {
      const makerMatch = String(row?.makerLabelDisplay ?? '').toLowerCase().includes(lowered);
      const makerIdMatch = String(row?.makerIdDisplay ?? '').toLowerCase().includes(lowered);
      const membershipIdMatch = String(row?.membership_id ?? '').toLowerCase().includes(lowered);
      return makerMatch || makerIdMatch || membershipIdMatch;
    });
  }, [membershipRows, query]);

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

  const uniqueMakerCount = useMemo(() => {
    return new Set(
      membershipRows
        .map((row) => String(row?.makerDocumentId ?? row?.makerIdDisplay ?? ''))
        .filter(Boolean)
    ).size;
  }, [membershipRows]);

  const columns = useMemo(
    () => [
      { key: 'membership_id', header: 'Membership ID' },
      { key: 'makerIdDisplay', header: 'Maker ID' },
      { key: 'makerLabelDisplay', header: 'Maker' },
      {
        key: 'entry_date_1',
        header: 'Entry From',
        render: (value) => formatYear(value),
      },
      {
        key: 'entry_date_2',
        header: 'Entry To',
        render: (value) => formatYear(value),
      },
      {
        key: 'makerDocumentId',
        header: 'Record',
        sortable: false,
        render: (_value, row) => {
          if (!row.makerDocumentId) return '—';

          return (
            <Link
              href={`/data/maker/detail?id=${row.makerDocumentId}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              View maker
            </Link>
          );
        },
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

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          No guild id provided.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/data/guild" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Back to guilds
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {guild?.name ?? `Guild #${id}`}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Document ID: {guild?.documentId ?? id}</p>
          </div>

          <div className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            Guild ID: {guild?.guild_id ?? '—'}
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-zinc-600 dark:text-zinc-300">Loading guild details...</p>
        ) : (
          <>
            <section className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Membership Summary
              </h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                {membershipRows.length} membership rows across {uniqueMakerCount} unique makers.
              </p>
            </section>

            <div className="w-full max-w-lg">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Search Memberships
              </label>
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                  setPageInput('1');
                }}
                placeholder="Type maker name, maker id, or membership id..."
                className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <TableDisplay
              data={pagedRows}
              columns={columns}
              rowKey="id"
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
              emptyMessage="No memberships found for this guild."
            />

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Page {safeCurrentPage} of {pageCount} ({filteredRows.length} matching membership rows)
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
                  <label htmlFor="guild-detail-page-input" className="text-sm text-zinc-600 dark:text-zinc-300">
                    Go to
                  </label>
                  <input
                    id="guild-detail-page-input"
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

export default function GuildDetailPage() {
  return (
    <Suspense>
      <GuildDetail />
    </Suspense>
  );
}
