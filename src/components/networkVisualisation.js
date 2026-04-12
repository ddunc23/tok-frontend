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
 *   - Related makers   (type: maker, fill: blue)  — via relations[].disambiguated_relation.target_maker
 *   - Guilds           (type: guild, fill: amber)  — via memberships[].guild
 *   - Towns            (type: town,  fill: emerald) — via addresses[].town_location
 *
 * Clicking a related-maker node navigates to their detail page.
 *
 * Props:
 *   maker – the fully-populated maker object returned from the Strapi API
 *   height – optional CSS height string (default: '500px')
 */
export default function NetworkVisualisation({ maker, height = '500px' }) {
  const router = useRouter();

  console.log('Rendering NetworkVisualisation with maker:', maker);

  const { nodes, edges } = useMemo(() => {
    if (!maker) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();

    const addNode = (node) => {
      if (!seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        nodes.push(node);
      }
    };

    const focalId = `maker-${maker.documentId}`;
    const focalLabel = [maker.first_name, maker.surname].filter(Boolean).join(' ') || `Maker #${maker.id}`;

    addNode({
      id: focalId,
      label: focalLabel,
      fill: '#6366f1', // indigo — focal maker
      data: { type: 'maker', makerId: maker.documentId },
    });

    // ── Related makers via relations ────────────────────────────────────────
    for (const rel of maker.relations ?? []) {
      const target = rel.target_maker;
      if (!target?.id) continue;

      const targetId = `maker-${target.id}`;
      const targetLabel =
        [target.first_name, target.surname].filter(Boolean).join(' ') || `Maker #${target.id}`;
      const edgeLabel = rel.relation_type?.name ?? rel.relation_description ?? 'relation';

      addNode({
        id: targetId,
        label: targetLabel,
        fill: '#3b82f6', // blue — related maker
        data: { type: 'maker', makerId: target.documentId },
      });

      edges.push({
        id: `rel-${rel.id}`,
        source: focalId,
        target: targetId,
        label: edgeLabel,
      });
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

      edges.push({
        id: `membership-${membership.id}`,
        source: focalId,
        target: guildId,
        label: 'member of',
      });
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

      edges.push({
        id: `address-${address.id}-town`,
        source: focalId,
        target: townId,
        label: 'located in',
      });
    }

    return { nodes, edges };
  }, [maker]);

  const handleNodeClick = (node) => {
    if (node?.data?.type === 'maker' && node.data.makerId !== maker?.id) {
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