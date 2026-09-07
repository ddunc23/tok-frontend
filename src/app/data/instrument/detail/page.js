'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TableDisplay from '@/components/tableDisplay';
import { requests } from '@/utils/requests';

const PAGE_SIZE = 25;

function TermList({ items = [], emptyMessage = 'None recorded.', linkable = false }) {
  if (!items.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const label = typeof item === 'string' ? item : item?.label;
        if (!label) return null;

        const targetId = typeof item === 'string' ? null : item?.id;
        const key = typeof item === 'string' ? `${item}-${index}` : `${item?.id ?? item?.termId ?? item?.label}-${index}`;

        const badgeClassName =
          'inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';

        if (linkable && targetId) {
          return (
            <Link
              key={key}
              href={`/data/instrument/detail?id=${targetId}`}
              className={`${badgeClassName} hover:bg-zinc-100 hover:underline dark:hover:bg-zinc-700`}
            >
              {label}
            </Link>
          );
        }

        return (
          <span key={key} className={badgeClassName}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function InstrumentDetail() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const id = searchParams.get('id');

  const [termInfo, setTermInfo] = useState(null);
  const [makers, setMakers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0 });
  const [termCode, setTermCode] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);

  useEffect(() => {
    const pageRaw = searchParams.get('page') ?? '1';
    const parsedPage = Number.parseInt(pageRaw, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setIsHydratedFromQuery(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery || !id) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('id', id);

    if (currentPage > 1) nextParams.set('page', String(currentPage));
    else nextParams.delete('page');

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [currentPage, id, isHydratedFromQuery, pathname, router, searchParams]);

  useEffect(() => {
    if (!isHydratedFromQuery || !id) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const facetResponse = await fetch(
          `${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'}/api/maker-extendeds/facet-counts?filters=${encodeURIComponent(JSON.stringify({}))}`
        );

        if (!facetResponse.ok) {
          throw new Error(`Failed to fetch instrument detail: ${facetResponse.statusText}`);
        }

        const facetPayload = await facetResponse.json();
        const selectedOption = (facetPayload?.instrumentOptions ?? []).find(
          (entry) => String(entry?.id) === String(id)
        );

        setTermInfo(
          selectedOption
            ? {
                id: selectedOption.id,
                preferred_label: selectedOption.label,
                count: selectedOption.count ?? 0,
                knownCount: selectedOption.knownCount ?? 0,
                advertisedCount: selectedOption.advertisedCount ?? 0,
                alternativeLabels: selectedOption.alternativeLabels ?? [],
                relatedTerms: selectedOption.relatedTerms ?? [],
                broaderTerms: selectedOption.broaderTerms ?? [],
                narrowerTerms: selectedOption.narrowerTerms ?? [],
              }
            : null
        );
        setTermCode(Number.isFinite(Number(selectedOption?.termCode)) ? Number(selectedOption.termCode) : null);

        if (!Number.isFinite(Number(selectedOption?.termCode))) {
          setMakers([]);
          setMeta({ page: 1, pageSize: PAGE_SIZE, total: 0 });
          return;
        }

        const code = Number(selectedOption.termCode);
        const makersResponse = await requests.makersExtended.listPage(
          {
            filters: {
              $or: [
                { instruments_known: { inst_code: { $in: [code] } } },
                { instruments_advertised: { inst_code: { $in: [code] } } },
              ],
            },
            sort: ['Surname:asc', 'First_name:asc', 'Label:asc'],
            populate: {
              instruments_known: true,
              instruments_advertised: true,
            },
          },
          {
            page: currentPage,
            pageSize: PAGE_SIZE,
          }
        );

        setMakers(makersResponse?.data ?? []);
        setMeta(makersResponse?.meta?.pagination ?? { page: currentPage, pageSize: PAGE_SIZE, total: 0 });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching instrument details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, id, isHydratedFromQuery]);

  const pageCount = Math.max(1, Math.ceil((meta.total ?? 0) / (meta.pageSize || PAGE_SIZE)));

  const makerRows = useMemo(
    () =>
      makers.map((maker) => {
        const hasKnown = (maker.instruments_known ?? []).some((row) => Number(row.inst_code) === Number(termCode));
        const hasAdvertised = (maker.instruments_advertised ?? []).some(
          (row) => Number(row.inst_code) === Number(termCode)
        );

        const makerIdDisplay = maker.Maker_ID ?? maker.maker_id ?? '—';
        const makerNameFromParts = [maker.First_name ?? maker.first_name, maker.Surname ?? maker.surname]
          .filter(Boolean)
          .join(' ');
        const makerLabelDisplay =
          (maker.Label ?? maker.label ?? makerNameFromParts) ||
          maker.Organisation_Name ||
          `Maker #${maker.id ?? 'unknown'}`;

        const associationTypes = [];
        if (hasKnown) associationTypes.push('KNOWN');
        if (hasAdvertised) associationTypes.push('ADVERTISED');

        return {
          ...maker,
          makerIdDisplay,
          makerLabelDisplay,
          associationTypes,
          associationLabel: associationTypes.join(', ') || '—',
        };
      }),
    [makers, termCode]
  );

  const columns = useMemo(
    () => [
      { key: 'makerIdDisplay', header: 'Maker ID' },
      { key: 'makerLabelDisplay', header: 'Maker' },
      { key: 'associationLabel', header: 'Association' },
      {
        key: 'documentId',
        header: 'Record',
        sortable: false,
        render: (_value, row) => (
          <Link
            href={`/data/maker/detail?id=${row.documentId ?? row.id}`}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            View maker
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

    const nextPage = Math.min(Math.max(parsed, 1), pageCount);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  };

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          No instrument id provided.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/data/instrument"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Back to instruments
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {termInfo?.preferred_label ?? `Instrument #${id}`}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Term ID: {termInfo?.id ?? id}
            </p>
          </div>

          <div className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            Code: {termCode ?? '—'}
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-zinc-600 dark:text-zinc-300">Loading instrument details...</p>
        ) : (
          <>
            <section className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Vocabulary Context
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Alternative Terms
                  </h3>
                  <TermList items={termInfo?.alternativeLabels ?? []} emptyMessage="No alternative terms." />
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Related Terms
                  </h3>
                  <TermList items={termInfo?.relatedTerms ?? []} emptyMessage="No related terms." />
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Broader Terms
                  </h3>
                  <TermList
                    items={termInfo?.broaderTerms ?? []}
                    emptyMessage="No broader terms."
                    linkable
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Narrower Terms
                  </h3>
                  <TermList
                    items={termInfo?.narrowerTerms ?? []}
                    emptyMessage="No narrower terms."
                    linkable
                  />
                </div>
              </div>
            </section>

            <section className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Related Makers
              </h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                Showing page {meta.page ?? currentPage} of {pageCount} ({meta.total ?? 0} makers)
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Known: {termInfo?.knownCount ?? 0} | Advertised: {termInfo?.advertisedCount ?? 0}
              </p>
            </section>

            <TableDisplay
              data={makerRows}
              columns={columns}
              rowKey="id"
              emptyMessage="No makers found for this instrument."
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={(meta.page ?? 1) <= 1 || isLoading}
                className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                disabled={(meta.page ?? 1) >= pageCount || isLoading}
                className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                Next
              </button>
              <form onSubmit={handlePageSubmit} className="ml-2 flex items-center gap-2">
                <label htmlFor="instrument-detail-page" className="text-sm text-zinc-600 dark:text-zinc-300">
                  Go to
                </label>
                <input
                  id="instrument-detail-page"
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
          </>
        )}
      </main>
    </div>
  );
}

export default function InstrumentDetailPage() {
  return (
    <Suspense>
      <InstrumentDetail />
    </Suspense>
  );
}
