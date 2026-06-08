'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { requests } from '@/utils/requests';
import NetworkVisualisation from '@/components/networkVisualisation';
import { Suspense } from 'react';


// ─── Small presentational helpers ───────────────────────────────────────────

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-sm text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function Section({ title, children, empty }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-zinc-200 pb-1 text-base font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
        {title}
      </h2>
      {empty ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function AddressesSection({ addresses }) {
  if (!addresses?.length)
    return <Section title="Addresses" empty="No addresses recorded." />;

  return (
    <Section title="Addresses">
      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Street 1
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Street 2
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Town
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-950">
            {addresses.map((addr) => {
              const town = addr.town_location;
              return (
                <tr key={addr.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
                    {addr.street_1?.replace(/,\s*$/, '') ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
                    {addr.street_2?.replace(/,\s*$/, '') ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
                    {town ? (town.town ?? town.name ?? town.id) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function GuildMembershipsSection({ memberships }) {
  if (!memberships?.length)
    return <Section title="Guild Memberships" empty="No guild memberships recorded." />;

  return (
    <Section title="Guild Memberships">
      <ul className="flex flex-col gap-3">
        {memberships.map((m) => (
          <li
            key={m.id}
            className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              <Field label="Guild" value={m.guild?.name} />
              <Field label="Entry from" value={m.entry_date_1} />
              <Field label="Entry to" value={m.entry_date_2} />
            </dl>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RelationsSection({ relations, relationTargets }) {
  const hasRelations = relations?.length > 0;
  const hasTargets = relationTargets?.length > 0;

  if (!hasRelations && !hasTargets)
    return <Section title="Relations" empty="No relations recorded." />;

  return (
    <Section title="Relations">
      <ul className="flex flex-col gap-3">
        {/* Outgoing relations */}
        {relations?.map((rel) => {
          const targetMaker = rel.target_maker_extended;
          const targetName = targetMaker
            ? [
                targetMaker.Label ?? targetMaker.label,
                [targetMaker.First_name ?? targetMaker.first_name, targetMaker.Surname ?? targetMaker.surname]
                  .filter(Boolean)
                  .join(' '),
              ]
                .filter(Boolean)
                [0]
            : null;

          return (
            <li
              key={`rel-${rel.id}`}
              className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                <Field label="Type" value={rel.relation_type?.name ?? rel.relation_description} />
                {targetMaker ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Identified maker
                    </dt>
                    <dd>
                      <Link
                        href={`/data/maker/detail?id=${targetMaker.documentId ?? targetMaker.id}`}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {targetName || `Maker #${targetMaker.id}`}
                      </Link>
                    </dd>
                  </div>
                ) : (
                  <Field label="Identified maker" value={rel.assigned_name} />
                )}
              </dl>
            </li>
          );
        })}
        {/* Incoming relations */}
        {relationTargets?.map((relTarget) => {
          const sourceMaker = relTarget.maker_extended ?? relTarget.maker;
          const sourceName = sourceMaker
            ? [
                sourceMaker.Label ?? sourceMaker.label,
                [sourceMaker.First_name ?? sourceMaker.first_name, sourceMaker.Surname ?? sourceMaker.surname]
                  .filter(Boolean)
                  .join(' '),
              ]
                .filter(Boolean)
                [0]
            : null;

          return (
            <li
              key={`target-${relTarget.id}`}
              className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                <Field label="Type" value={relTarget.relation_type?.name ?? relTarget.relation_description} />
                {sourceMaker ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Related maker
                    </dt>
                    <dd>
                      <Link
                        href={`/data/maker/detail?id=${sourceMaker.documentId ?? sourceMaker.id}`}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {sourceName || `Maker #${sourceMaker.id}`}
                      </Link>
                    </dd>
                  </div>
                ) : (
                  <Field label="Related maker" value={relTarget.assigned_name} />
                )}
              </dl>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function InstrumentsSection({ title, instruments }) {
  if (!instruments?.length)
    return <Section title={title} empty="None recorded." />;

  return (
    <Section title={title}>
      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Instrument
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-950">
            {instruments.map((entry) => (
              <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
                  {entry.inst_name?.replace(/,\s*$/, '') ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function MakerDetail() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [maker, setMaker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setErrorMessage('No maker ID provided.');
      setIsLoading(false);
      return;
    }

    const fetchMaker = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const response = await requests.makersExtended.get(id, {
          populate: {
            addresses: { populate: { town_location: true } },
            memberships: { populate: { guild: true } },
            relations: { populate: { target_maker_extended: true, maker: true } },
            relation_targets: { populate: { target_maker_extended: true, maker_extended: true } },
            instruments_advertised: true,
            instruments_known: true,
          },
        });
        setMaker(response?.data ?? null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error fetching maker.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaker();
  }, [id]);

  const fullName = maker
    ? maker.Label ||
      [maker.First_name, maker.Surname].filter(Boolean).join(' ') ||
      maker.Organisation_Name ||
      null
    : null;

  const dateLabel = maker
    ? [
        maker.Date1_qual,
        maker.Date_1,
        (maker.Date_1 || maker.Date2_qual) && '–',
        maker.Date2_qual,
        maker.Date_2,
      ]
        .filter(Boolean)
        .join(' ')
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        {/* Back navigation */}
        <Link
          href="/data/maker"
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to Makers
        </Link>

        {errorMessage && (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        {isLoading && (
          <p className="text-zinc-600 dark:text-zinc-300">Loading maker…</p>
        )}

        {!isLoading && maker && (
          <>
            {/* Identity */}
            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                {fullName || 'Unknown Maker'}
              </h1>
              {(maker.Alt_name1 || maker.Alt_name2) && (
                <p className="text-base text-zinc-500 dark:text-zinc-400">
                  Also known as:{' '}
                  <span className="italic">{[maker.Alt_name1, maker.Alt_name2].filter(Boolean).join(', ')}</span>
                </p>
              )}
              {dateLabel && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateLabel}</p>
              )}
            </div>

            {/* Core fields */}
            <Section title="Details">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                <Field label="Maker ID" value={maker.Maker_ID} />
                <Field label="Maker Type" value={maker.Maker_Type} />
                <Field label="Actor Type" value={maker.Actor_Type} />
                <Field label="Organisation" value={maker.Organisation_Name} />
                <Field label="Title" value={maker.Title} />
                <Field label="Initials" value={maker.Initials} />
                <Field label="Surname" value={maker.Surname} />
                <Field label="First Name" value={maker.First_name} />
                <Field label="Suffix" value={maker.Suffix} />
                <Field label="Disambiguation" value={maker.Disambiguation_Numeral} />
                <Field label="VIAF" value={maker.VIAF_URI} />
                <Field label="Wikidata" value={maker.Wikidata_URI} />
              </dl>
              {[maker.Misc_Info]
                .filter(Boolean)
                .map((text, i) => (
                  <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {text}
                  </p>
                ))}
            </Section>

            <AddressesSection addresses={maker.addresses} />
            <GuildMembershipsSection memberships={maker.memberships} />
            <RelationsSection relations={maker.relations} relationTargets={maker.relation_targets} />

            <InstrumentsSection title="Instruments Advertised" instruments={maker.instruments_advertised} />
            <InstrumentsSection title="Instruments Known" instruments={maker.instruments_known} />
            <Section title="Network">
              <NetworkVisualisation maker={maker} height="480px" />
            </Section>
          </>
        )}

        {!isLoading && !maker && !errorMessage && (
          <p className="text-zinc-600 dark:text-zinc-300">Maker not found.</p>
        )}
      </main>
    </div>
  );
}


export default function MakerDetailPage() {
  return (
    <Suspense>
      <MakerDetail />
    </Suspense>
  );
}
