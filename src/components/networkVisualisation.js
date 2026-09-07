'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { requests } from '@/utils/requests';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

/**
 * NetworkVisualisation
 *
 * Renders a maker and their relationships as an interactive network graph.
 *
 * Nodes:
 *   - The focal maker  (type: maker, fill: indigo)
 *   - Related makers   (type: maker, fill: blue)  — via relations[] and relation_targets[]
 *   - Guilds           (type: guild, fill: amber)  — via memberships[].guild
 *   - Towns            (type: town,  fill: emerald) — via addresses[].town_location
 *   - Instruments      (type: instrument, fill: rose) — via term_associations (or legacy instrument fields)
 *
 * Features:
 *   - Clicking a related-maker node navigates to their detail page.
 *   - "Expand by 1 degree" button fetches related makers for all currently visible makers
 *     and adds them to the graph (shows as light blue nodes). Only expands social relations,
 *     not locations or instruments.
 *
 * Props:
 *   maker – the fully-populated maker object returned from the Strapi API
 *   height – optional CSS height string (default: '500px')
 */
export default function NetworkVisualisation({ maker, height = '500px' }) {
  const router = useRouter();
  const [expandedMakers, setExpandedMakers] = useState([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState('');
  const [visibleTypes, setVisibleTypes] = useState({
    maker: true,
    guild: true,
    town: true,
    instrument: true,
  });

  const getMakerDocumentId = (item) => item?.documentId ?? item?.id ?? null;
  const getMakerLabel = (item) =>
    item?.Label ||
    [item?.First_name ?? item?.first_name, item?.Surname ?? item?.surname]
      .filter(Boolean)
      .join(' ') ||
    item?.Organisation_Name ||
    `Maker #${item?.id ?? 'unknown'}`;

  const getTermAssociationInstruments = (makerData) => {
    const grouped = {
      ADVERTISED: [],
      KNOWN: [],
    };

    const seenByType = {
      ADVERTISED: new Set(),
      KNOWN: new Set(),
    };

    for (const association of makerData?.term_associations ?? []) {
      const type = String(association?.association_type ?? '').toUpperCase();
      if (type !== 'ADVERTISED' && type !== 'KNOWN') continue;

      const term = association?.term;
      const rawLabel =
        term?.preferred_label ??
        term?.preferred_term ??
        term?.name ??
        association?.evidence_label;
      if (!rawLabel) continue;

      const label = String(rawLabel).replace(/,\s*$/, '').trim();
      if (!label) continue;

      const key = String(term?.id ?? label).toLowerCase();
      if (seenByType[type].has(key)) continue;
      seenByType[type].add(key);

      grouped[type].push({
        id: term?.id ?? association?.id,
        label,
      });
    }

    return grouped;
  };

  const handleExpandGraph = async () => {
    if (!maker) return;
    
    try {
      setIsExpanding(true);
      setExpandError('');
      
      // Collect all maker IDs currently in the graph (relations and relation_targets)
      const expandedMakerIds = new Set(expandedMakers.map((m) => m.documentId));
      const makerIdsToExpand = new Set();
      
      for (const rel of maker.relations ?? []) {
        const target = rel.target_maker_extended ?? rel.target_maker;
        if (target?.documentId && !expandedMakerIds.has(target.documentId)) {
          makerIdsToExpand.add(target.documentId);
        }
      }
      
      for (const relTarget of maker.relation_targets ?? []) {
        const source = relTarget.maker_extended ?? relTarget.maker;
        if (source?.documentId && !expandedMakerIds.has(source.documentId)) {
          makerIdsToExpand.add(source.documentId);
        }
      }
      
      if (makerIdsToExpand.size === 0) {
        setExpandError('No new makers to expand.');
        return;
      }
      
      // Fetch each related maker to get their relations
      const expandPromises = Array.from(makerIdsToExpand).map((makerId) =>
        requests.makersExtended.get(makerId, {
          populate: ['relations.target_maker_extended', 'relation_targets.maker_extended'],
        })
      );
      
      const responses = await Promise.all(expandPromises);
      const newExpandedMakers = responses
        .map((response) => response?.data)
        .filter((m) => m?.documentId);
      
      setExpandedMakers([...expandedMakers, ...newExpandedMakers]);
    } catch (error) {
      setExpandError(error instanceof Error ? error.message : 'Error expanding graph.');
    } finally {
      setIsExpanding(false);
    }
  };

  const { nodes, edges } = useMemo(() => {
    if (!maker) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();
    const seenEdgeKeys = new Set();

    const addNode = (node) => {
      const nextNode = { draggable: true, ...node };

      if (!seenNodeIds.has(nextNode.id)) {
        seenNodeIds.add(nextNode.id);
        nodes.push(nextNode);
      }
    };

    const addEdge = ({ source, target, label }) => {
      const edgeKey = `${source}->${target}|${label ?? ''}`;
      if (seenEdgeKeys.has(edgeKey)) return;

      seenEdgeKeys.add(edgeKey);
      edges.push({
        id: edgeKey,
        source,
        target,
        label,
      });
    };

    const focalMakerId = getMakerDocumentId(maker);
    const focalId = `maker-${focalMakerId}`;
    const focalLabel = getMakerLabel(maker);

    addNode({
      id: focalId,
      label: focalLabel,
      fill: '#6366f1', // indigo — focal maker
      data: { type: 'maker', makerId: focalMakerId },
    });

    // ── Related makers via outgoing relations ───────────────────────────────
    for (const rel of maker.relations ?? []) {
      const target = rel.target_maker_extended ?? rel.target_maker;
      if (!target?.id) continue;

      const targetMakerId = getMakerDocumentId(target);
      const targetId = `maker-${targetMakerId}`;
      const targetLabel = getMakerLabel(target);
      const edgeLabel = rel.relation_type?.name ?? rel.relation_description ?? 'relation';

      addNode({
        id: targetId,
        label: targetLabel,
        fill: '#3b82f6', // blue — related maker
        data: { type: 'maker', makerId: targetMakerId },
      });

      addEdge({ source: focalId, target: targetId, label: edgeLabel });
    }

    // ── Related makers via incoming relation targets ────────────────────────
    for (const relTarget of maker.relation_targets ?? []) {
      const source = relTarget.maker_extended ?? relTarget.maker;
      if (!source?.id) continue;

      const sourceMakerId = getMakerDocumentId(source);
      const sourceId = `maker-${sourceMakerId}`;
      const sourceLabel = getMakerLabel(source);
      const edgeLabel = relTarget.relation_type?.name ?? relTarget.relation_description ?? 'relation';

      addNode({
        id: sourceId,
        label: sourceLabel,
        fill: '#3b82f6', // blue — related maker
        data: { type: 'maker', makerId: sourceMakerId },
      });

      addEdge({ source: sourceId, target: focalId, label: edgeLabel });
    }

    // ── Expanded makers' relations (one degree further) ──────────────────────
    for (const expandedMaker of expandedMakers) {
      const expandedMakerId = getMakerDocumentId(expandedMaker);
      const expandedId = `maker-${expandedMakerId}`;

      // Add relations from expanded maker
      for (const rel of expandedMaker.relations ?? []) {
        const target = rel.target_maker_extended ?? rel.target_maker;
        if (!target?.id) continue;

        const targetMakerId = getMakerDocumentId(target);
        const targetId = `maker-${targetMakerId}`;
        const targetLabel = getMakerLabel(target);
        const edgeLabel = rel.relation_type?.name ?? rel.relation_description ?? 'relation';

        addNode({
          id: targetId,
          label: targetLabel,
          fill: '#93c5fd', // light blue — second degree maker
          data: { type: 'maker', makerId: targetMakerId },
        });

        addEdge({ source: expandedId, target: targetId, label: edgeLabel });
      }

      // Add incoming relation targets to expanded maker
      for (const relTarget of expandedMaker.relation_targets ?? []) {
        const source = relTarget.maker_extended ?? relTarget.maker;
        if (!source?.id) continue;

        const sourceMakerId = getMakerDocumentId(source);
        const sourceId = `maker-${sourceMakerId}`;
        const sourceLabel = getMakerLabel(source);
        const edgeLabel = relTarget.relation_type?.name ?? relTarget.relation_description ?? 'relation';

        addNode({
          id: sourceId,
          label: sourceLabel,
          fill: '#93c5fd', // light blue — second degree maker
          data: { type: 'maker', makerId: sourceMakerId },
        });

        addEdge({ source: sourceId, target: expandedId, label: edgeLabel });
      }
    }

    // ── Guilds via memberships ───────────────────────────────────────────────
    for (const membership of maker.memberships ?? []) {
      const guild = membership.guild;
      if (!guild?.id) continue;

      const guildId = `guild-${guild.id}`;

      addNode({
        id: guildId,
        label: guild.name ?? `Guild #${guild.id}`,
        fill: '#f59e0b', // amber — guild
        data: { type: 'guild', guildId: guild.id },
      });

      addEdge({ source: focalId, target: guildId, label: 'member of' });
    }

    // ── Towns via addresses ──────────────────────────────────────────────────
    for (const address of maker.addresses ?? []) {
      const town = address.town_location;
      if (!town?.id) continue;

      const townId = `town-${town.id}`;
      const townLabel = town.town ?? town.name ?? `Town #${town.id}`;

      addNode({
        id: townId,
        label: townLabel,
        fill: '#10b981', // emerald — town
        data: { type: 'town', townId: town.id },
      });

      addEdge({ source: focalId, target: townId, label: 'located in' });
    }

    // ── Instruments via term associations (or legacy fields) ─────────────────
    const addInstrumentNodeAndEdge = (instrument, relationLabel) => {
      if (!instrument) return;

      const rawInstrumentLabel = instrument.label ?? instrument.inst_name;
      const instrumentLabelText = rawInstrumentLabel
        ? String(rawInstrumentLabel).replace(/,\s*$/, '').trim()
        : null;
      const instrumentKey = instrument.id ?? `${instrumentLabelText ?? 'unknown'}-${instrument.inst_code ?? ''}`;
      const instrumentId = `instrument-${instrumentKey}`;
      const instrumentLabel = instrumentLabelText ?? `Instrument #${instrumentKey}`;

      addNode({
        id: instrumentId,
        label: instrumentLabel,
        fill: '#f43f5e',
        data: { type: 'instrument', instrumentId: instrument.id ?? null },
      });

      addEdge({ source: focalId, target: instrumentId, label: relationLabel });
    };

    const groupedInstruments = getTermAssociationInstruments(maker);

    const advertisedInstruments = groupedInstruments.ADVERTISED.length
      ? groupedInstruments.ADVERTISED
      : (maker.instruments_advertised ?? []);
    const knownInstruments = groupedInstruments.KNOWN.length
      ? groupedInstruments.KNOWN
      : (maker.instruments_known ?? []);

    for (const instrument of advertisedInstruments) {
      addInstrumentNodeAndEdge(instrument, 'advertised');
    }

    for (const instrument of knownInstruments) {
      addInstrumentNodeAndEdge(instrument, 'known for');
    }

    const filteredNodeIds = new Set(
      nodes
        .filter((node) => {
          if (node.id === focalId) return true; // Keep focal maker always visible.
          const nodeType = node?.data?.type;
          return visibleTypes[nodeType] !== false;
        })
        .map((node) => node.id)
    );

    const filteredNodes = nodes.filter((node) => filteredNodeIds.has(node.id));
    const filteredEdges = edges.filter(
      (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [maker, expandedMakers, visibleTypes]);

  const toggleType = (type) => {
    setVisibleTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  const handleNodeClick = (node) => {
    if (node?.data?.type === 'maker' && node.data.makerId && node.data.makerId !== maker?.documentId) {
      router.push(`/data/maker/detail?id=${node.data.makerId}`);
    }
  };

  if (!maker) return null;

  if (nodes.length <= 1) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        No network connections to display.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExpandGraph}
          disabled={isExpanding}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {isExpanding ? 'Expanding…' : 'Expand by 1 degree'}
        </button>
        {expandError && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{expandError}</p>
        )}
        {expandedMakers.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {expandedMakers.length} level{expandedMakers.length !== 1 ? 's' : ''} expanded
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Show
        </span>
        {[
          { key: 'maker', label: 'Makers' },
          { key: 'guild', label: 'Guilds' },
          { key: 'town', label: 'Towns' },
          { key: 'instrument', label: 'Instruments' },
        ].map((item) => {
          const isActive = visibleTypes[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleType(item.key)}
              className={[
                'rounded border px-2 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
              ].join(' ')}
              aria-pressed={isActive}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div style={{ height }} className="w-full relative overflow-hidden rounded border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          labelType="all"
          cameraMode="pan"
          draggable
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}