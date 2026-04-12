'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { requests } from '@/utils/requests';
import NetworkVisualisation from '@/components/networkVisualisation';


const instrumentAdvertisedSchema = {
  "kind": "collectionType",
  "collectionName": "instruments_advertised",
  "info": {
    "singularName": "instrument-advertised",
    "pluralName": "instruments-advertised",
    "displayName": "Instrument Advertised",
    "description": "Instruments advertised by a maker"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "maker": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::maker.maker",
      "inversedBy": "instruments_advertised"
    },
    "inst_code": {
      "type": "integer"
    },
    "inst_name": {
      "type": "string",
      "maxLength": 510
    },
    "maker_id": {
      "type": "integer"
    }
  }
}

const instrumentKnownSchema = {
  "kind": "collectionType",
  "collectionName": "instruments_known",
  "info": {
    "singularName": "instrument-known",
    "pluralName": "instruments-known",
    "displayName": "Instrument Known",
    "description": "Instruments known to be made by a maker"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "maker": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::maker.maker",
      "inversedBy": "instruments_known"
    },
    "inst_code": {
      "type": "integer"
    },
    "inst_name": {
      "type": "string",
      "maxLength": 510
    },
    "maker_id": {
      "type": "integer"
    }
  }
}



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

function RelationsSection({ relations }) {
  if (!relations?.length)
    return <Section title="Relations" empty="No relations recorded." />;

  return (
    <Section title="Relations">
      <ul className="flex flex-col gap-3">
        {relations.map((rel) => {
          const targetMaker = rel.target_maker;
          const targetName = targetMaker
            ? [targetMaker.first_name, targetMaker.surname].filter(Boolean).join(' ')
            : null;

          return (
            <li
              key={rel.id}
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
                        href={`/data/maker/detail?id=${targetMaker.documentId}`}
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
                  {entry.inst_name.replace(/,\s*$/, "") ?? '—'}
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

export default function MakerDetail() {
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
        const response = await requests.makers.get(id, {
          populate: {
            addresses: { populate: { town_location: true } },
            memberships: { populate: { guild: true } },
            relations: {
              populate: {
                relation_type: true,
                relation_type_meta: true,
                target_maker: true,
              },
            },
            instruments_advertised: true,
            instruments_known: true,
            sources: true,
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
    ? [maker.first_name, maker.surname].filter(Boolean).join(' ')
    : null;

  const dateLabel = maker
    ? [
        maker.Date1_qual,
        maker.date_1,
        (maker.date_1 || maker.Date2_qual) && '–',
        maker.Date2_qual,
        maker.date_2,
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
              {maker.Alt_name && (
                <p className="text-base text-zinc-500 dark:text-zinc-400">
                  Also known as: <span className="italic">{maker.Alt_name}</span>
                </p>
              )}
              {dateLabel && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateLabel}</p>
              )}
            </div>

            {/* Core fields */}
            <Section title="Details">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                <Field label="Advertised trade" value={maker.Adv_trade1} />
                <Field label="Advertised trade 2" value={maker.Adv_trade2} />
              </dl>
              {[maker.misc_info_1, maker.misc_info_2, maker.misc_info_3, maker.misc_info_4]
                .filter(Boolean)
                .map((text, i) => (
                  <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {text}
                  </p>
                ))}
            </Section>

            <AddressesSection addresses={maker.addresses} />
            <GuildMembershipsSection memberships={maker.memberships} />
            <RelationsSection relations={maker.relations} />

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

