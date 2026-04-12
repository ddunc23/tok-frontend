'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TableDisplay from '@/components/tableDisplay';
import DateFacet from '@/components/dateFacet';
import GuildFacet from '@/components/guildFacet';
import MakerSearchBox from '@/components/makerSearchBox';
import TownFacet from '@/components/townFacet';
import { requests } from '@/utils/requests';

function Makers() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [makers, setMakers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedGuildIds, setSelectedGuildIds] = useState([]);
  const [selectedTownIds, setSelectedTownIds] = useState([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [surnameQuery, setSurnameQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageSize] = useState(25);
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    pageCount: 1,
    total: 0,
  });

  // Hydrate filter/page state from URL (supports reload + back/forward)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const guildsRaw = searchParams.get('guilds') ?? '';
    const townsRaw = searchParams.get('towns') ?? '';
    const pageRaw = searchParams.get('page') ?? '1';

    const parsedGuilds = guildsRaw
      .split(',')
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));

    const parsedTowns = townsRaw
      .split(',')
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));

    const parsedPage = Number.parseInt(pageRaw, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    setSurnameQuery(q);
    setDateRange({ from, to });
  setSelectedGuildIds(parsedGuilds);
    setSelectedTownIds(parsedTowns);
    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setIsHydratedFromQuery(true);
  }, [searchParams]);

  // Keep URL synced with current facet/page state
  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const nextParams = new URLSearchParams(searchParams.toString());

    if (surnameQuery) nextParams.set('q', surnameQuery);
    else nextParams.delete('q');

    if (dateRange.from) nextParams.set('from', dateRange.from);
    else nextParams.delete('from');

    if (dateRange.to) nextParams.set('to', dateRange.to);
    else nextParams.delete('to');

    if (selectedGuildIds.length > 0) nextParams.set('guilds', selectedGuildIds.join(','));
    else nextParams.delete('guilds');

    if (selectedTownIds.length > 0) nextParams.set('towns', selectedTownIds.join(','));
    else nextParams.delete('towns');

    if (currentPage > 1) nextParams.set('page', String(currentPage));
    else nextParams.delete('page');

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [
    currentPage,
    dateRange.from,
    dateRange.to,
    isHydratedFromQuery,
    pathname,
    router,
    searchParams,
    selectedGuildIds,
    selectedTownIds,
    surnameQuery,
  ]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const fetchMakers = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        // Compose Strapi filters from all active facets.
        const filterClauses = [];

        if (surnameQuery !== '') {
          filterClauses.push({ surname: { $containsi: surnameQuery } });
        }

        if (selectedGuildIds.length > 0) {
          filterClauses.push({
            memberships: { guild: { id: { $in: selectedGuildIds } } },
          });
        }

        if (selectedTownIds.length > 0) {
          filterClauses.push({
            addresses: { town_location: { id: { $in: selectedTownIds } } },
          });
        }

        if (dateRange.from !== '') {
          filterClauses.push({ date_1: { $gte: Number(dateRange.from) } });
        }

        if (dateRange.to !== '') {
          filterClauses.push({ date_2: { $lte: Number(dateRange.to) } });
        }

        const queryParams = {
          ...(filterClauses.length > 0 ? { filters: { $and: filterClauses } } : {}),
          sort: ['surname:asc', 'first_name:asc'],
        };

        const response = await requests.makers.listPage(queryParams, { page: currentPage, pageSize });
        setMakers(response?.data ?? []);
        setPagination(
          response?.meta?.pagination ?? {
            page: currentPage,
            pageSize,
            pageCount: 1,
            total: 0,
          }
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching makers.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMakers();
  }, [
    currentPage,
    pageSize,
    selectedGuildIds,
    selectedTownIds,
    dateRange,
    surnameQuery,
    isHydratedFromQuery,
  ]);

  useEffect(() => {
    setPageInput(String(pagination.page || 1));
  }, [pagination.page]);

  const columns = useMemo(
    () => [
      { key: 'maker_id', header: 'ID' },
      { key: 'surname', header: 'Surname' },
      { key: 'first_name', header: 'First Name' },
      { key: 'date_1', header: 'Date 1' },
      { key: 'date_2', header: 'Date 2' },
      {
        key: 'documentId',
        header: 'Record',
        sortable: false,
        render: (_value, row) => (
          <Link
            href={`/data/maker/detail?id=${row.documentId}`}
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
      setPageInput(String(currentPage));
      return;
    }

    const nextPage = Math.min(Math.max(parsed, 1), pagination.pageCount || 1);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  };

  const handleTownChange = (ids) => {
    setSelectedTownIds(ids);
    setCurrentPage(1);
    setPageInput('1');
  };

  const handleGuildChange = (ids) => {
    setSelectedGuildIds(ids);
    setCurrentPage(1);
    setPageInput('1');
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setCurrentPage(1);
    setPageInput('1');
  };

  const handleSurnameChange = (value) => {
    setSurnameQuery(value);
    setCurrentPage(1);
    setPageInput('1');
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">Instrument Makers</h1>

        <div className="flex gap-8">

          <div className="flex flex-1 flex-col gap-4">
            <MakerSearchBox value={surnameQuery} onChange={handleSurnameChange} />
        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-zinc-600 dark:text-zinc-300">Loading makers…</p>
        ) : (
          <>
            <TableDisplay
              data={makers}
              columns={columns}
              rowKey="id"
              emptyMessage="No makers found."
            />

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Page {pagination.page} of {pagination.pageCount} ({pagination.total} total)
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(pagination.pageCount || 1, page + 1))
                  }
                  disabled={pagination.page >= pagination.pageCount || isLoading}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Next
                </button>
                <form onSubmit={handlePageSubmit} className="ml-2 flex items-center gap-2">
                  <label htmlFor="page-input" className="text-sm text-zinc-600 dark:text-zinc-300">
                    Go to
                  </label>
                  <input
                    id="page-input"
                    type="number"
                    min={1}
                    max={pagination.pageCount || 1}
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
          </div>
          <div className="flex flex-col gap-6">
            <GuildFacet selectedIds={selectedGuildIds} onChange={handleGuildChange} />
            <TownFacet selectedIds={selectedTownIds} onChange={handleTownChange} />
            <DateFacet dateRange={dateRange} onChange={handleDateRangeChange} />
          </div>
        </div>
        
      </main>
    </div>
  );
}

export default Makers;