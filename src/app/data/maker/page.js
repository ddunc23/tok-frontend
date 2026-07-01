'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TableDisplay from '@/components/tableDisplay';
import DateFacet from '@/components/dateFacet';
import GuildFacet from '@/components/guildFacet';
import MakerSearchBox from '@/components/makerSearchBox';
import SurnameFacet from '@/components/surnameFacet';
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
  const [surnameInitial, setSurnameInitial] = useState('');
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

  const [guildCounts, setGuildCounts] = useState({});
  const [townCounts, setTownCounts] = useState({});

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const initial = (searchParams.get('initial') ?? '').toUpperCase();
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const guildsRaw = searchParams.get('guilds') ?? '';
    const townsRaw = searchParams.get('towns') ?? '';
    const pageRaw = searchParams.get('page') ?? '1';

    const parsedGuilds = guildsRaw.split(',').filter(Boolean);
    const parsedTowns = townsRaw
      .split(',')
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));

    const parsedPage = Number.parseInt(pageRaw, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    setSurnameQuery(q);
    setSurnameInitial(initial.length === 1 ? initial : '');
    setDateRange({ from, to });
    setSelectedGuildIds(parsedGuilds);
    setSelectedTownIds(parsedTowns);
    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setIsHydratedFromQuery(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const nextParams = new URLSearchParams(searchParams.toString());

    if (surnameQuery) nextParams.set('q', surnameQuery);
    else nextParams.delete('q');

    if (surnameInitial) nextParams.set('initial', surnameInitial);
    else nextParams.delete('initial');

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
    surnameInitial,
    surnameQuery,
  ]);

  useEffect(() => {
    if (!isHydratedFromQuery) return;

    const fetchMakers = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const filterClauses = [];

        if (surnameQuery !== '') {
          filterClauses.push({ Label: { $containsi: surnameQuery } });
        }

        if (surnameInitial !== '') {
          filterClauses.push({ Surname: { $startsWithi: surnameInitial } });
        }

        if (selectedGuildIds.length > 0) {
          filterClauses.push({
            memberships: {
              guild: {
                documentId: { $in: selectedGuildIds },
              },
            },
          });
        }

        if (selectedTownIds.length > 0) {
          filterClauses.push({
            addresses: {
              town_location: {
                id: { $in: selectedTownIds },
              },
            },
          });
        }

        if (dateRange.from !== '') {
          filterClauses.push({ Date_1: { $gte: dateRange.from } });
        }

        if (dateRange.to !== '') {
          filterClauses.push({ Date_2: { $lte: dateRange.to } });
        }

        const queryParams = {
          ...(filterClauses.length > 0 ? { filters: { $and: filterClauses } } : {}),
          sort: ['Surname:asc', 'First_name:asc', 'Label:asc'],
        };

        const response = await requests.makersExtended.listPage(queryParams, {
          page: currentPage,
          pageSize,
        });

        setMakers(response?.data ?? []);
        setPagination(
          response?.meta?.pagination ?? {
            page: currentPage,
            pageSize,
            pageCount: 1,
            total: 0,
          }
        );

        // Fetch facet counts in parallel (don't await - let makers display immediately)
        fetchFacetCounts(filterClauses);
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
    dateRange,
    selectedGuildIds,
    selectedTownIds,
    surnameInitial,
    surnameQuery,
    isHydratedFromQuery,
  ]);

  const fetchFacetCounts = async (allFilterClauses) => {
    try {
      // Build filter query for API
      const filterQuery = allFilterClauses.length > 0
        ? JSON.stringify({ $and: allFilterClauses })
        : JSON.stringify({});

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'}/api/maker-extendeds/facet-counts?filters=${encodeURIComponent(filterQuery)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch facet counts: ${response.statusText}`);
      }

      const data = await response.json();
      setGuildCounts(data.guilds || {});
      setTownCounts(data.towns || {});
    } catch (error) {
      console.error('Error fetching facet counts:', error);
    }
  };

  useEffect(() => {
    setPageInput(String(pagination.page || 1));
  }, [pagination.page]);

  const columns = useMemo(
    () => [
      { key: 'Maker_ID', header: 'ID' },
      { key: 'Label', header: 'Label' },
      { key: 'Maker_Type', header: 'Maker Type' },
      {
        key: 'Date_1',
        header: 'Date 1',
        render: (value) => {
          if (!value) return '—';
          const text = String(value);
          return text.slice(0, 4);
        },
      },
      {
        key: 'Date_2',
        header: 'Date 2',
        render: (value) => {
          if (!value) return '—';
          const text = String(value);
          return text.slice(0, 4);
        },
      },
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

  const handleSurnameInitialChange = (value) => {
    setSurnameInitial(value);
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
            <SurnameFacet value={surnameInitial} onChange={handleSurnameInitialChange} />

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
                  rowKey="documentId"
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
            <DateFacet dateRange={dateRange} onChange={handleDateRangeChange} />
            <GuildFacet selectedIds={selectedGuildIds} onChange={handleGuildChange} counts={guildCounts} />
            <TownFacet selectedIds={selectedTownIds} onChange={handleTownChange} counts={townCounts} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MakersPage() {
  return (
    <Suspense>
      <Makers />
    </Suspense>
  );
}
