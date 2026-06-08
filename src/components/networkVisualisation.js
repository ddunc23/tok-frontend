'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

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
 *   - Instruments      (type: instrument, fill: rose) — via instruments_advertised / instruments_known
 *
 * Clicking a related-maker node navigates to their detail page.
 *
 * Props:
 *   maker – the fully-populated maker object returned from the Strapi API
 *   height – optional CSS height string (default: '500px')
 */
export default function NetworkVisualisation({ maker, height = '500px' }) {
  const router = useRouter();

  const getMakerDocumentId = (item) => item?.documentId ?? item?.id ?? null;
  const getMakerLabel = (item) =>
    item?.Label ||
    [item?.First_name ?? item?.first_name, item?.Surname ?? item?.surname]
      .filter(Boolean)
      .join(' ') ||
    item?.Organisation_Name ||
    `Maker #${item?.id ?? 'unknown'}`;

  const { nodes, edges } = useMemo(() => {
    if (!maker) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();
    const seenEdgeKeys = new Set();

    const addNode = (node) => {
      if (!seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        nodes.push(node);
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

    // ── Instruments via advertised / known relations ─────────────────────────
    const addInstrumentNodeAndEdge = (instrument, relationLabel) => {
      if (!instrument) return;

      const instrumentKey = instrument.id ?? `${instrument.inst_name ?? 'unknown'}-${instrument.inst_code ?? ''}`;
      const instrumentId = `instrument-${instrumentKey}`;
      const instrumentLabel = instrument.inst_name ?? `Instrument #${instrumentKey}`;

      addNode({
        id: instrumentId,
        label: instrumentLabel,
        fill: '#f43f5e',
        data: { type: 'instrument', instrumentId: instrument.id ?? null },
      });

      addEdge({ source: focalId, target: instrumentId, label: relationLabel });
    };

    for (const instrument of maker.instruments_advertised ?? []) {
      addInstrumentNodeAndEdge(instrument, 'advertised');
    }

    for (const instrument of maker.instruments_known ?? []) {
      addInstrumentNodeAndEdge(instrument, 'known for');
    }

    return { nodes, edges };
  }, [maker]);

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
    <div style={{ height }} className="w-full relative overflow-hidden rounded border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        labelType="all"
        cameraMode="pan"
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}