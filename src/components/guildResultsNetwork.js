'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { requests } from '@/utils/requests';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

function getGuildNodeId(guild) {
  const id = guild?.documentId ?? guild?.id;
  if (!id) return null;
  return `guild-${id}`;
}

function getGuildDetailId(guild) {
  return guild?.documentId ?? guild?.id ?? null;
}

function getMakerLabel(membership) {
  const maker = membership?.maker_extended;
  const fromParts = [maker?.First_name ?? maker?.first_name, maker?.Surname ?? maker?.surname]
    .filter(Boolean)
    .join(' ');

  return (
    maker?.Label ||
    maker?.label ||
    fromParts ||
    maker?.Organisation_Name ||
    `Maker #${maker?.Maker_ID ?? maker?.maker_id ?? membership?.maker_id ?? 'unknown'}`
  );
}

function getMakerNodeId(membership) {
  const maker = membership?.maker_extended;
  const detailId = maker?.documentId ?? maker?.id;

  if (detailId) return `maker-${detailId}`;
  if (membership?.maker_id != null) return `maker-mid-${membership.maker_id}`;
  if (membership?.id != null) return `maker-fallback-${membership.id}`;
  return null;
}

export default function GuildResultsNetwork({ guilds = [] }) {
  const router = useRouter();
  const [visibleTypes, setVisibleTypes] = useState({ guild: true, maker: true });
  const [expandedGuildMemberships, setExpandedGuildMemberships] = useState({});
  const [loadingGuildIds, setLoadingGuildIds] = useState([]);
  const [loadError, setLoadError] = useState('');

  const { nodes, edges } = useMemo(() => {
    const nodesOut = [];
    const edgesOut = [];
    const seenNodeIds = new Set();
    const seenEdgeIds = new Set();

    const addNode = (node) => {
      if (!node?.id || seenNodeIds.has(node.id)) return;
      seenNodeIds.add(node.id);
      nodesOut.push({ draggable: true, ...node });
    };

    const addEdge = (edge) => {
      if (!edge?.id || seenEdgeIds.has(edge.id)) return;
      seenEdgeIds.add(edge.id);
      edgesOut.push(edge);
    };

    const maxMembershipCount = guilds.reduce((max, guild) => {
      const count = Number(guild?.membershipCount ?? 0);
      return count > max ? count : max;
    }, 0);

    for (const guild of guilds) {
      const guildNodeId = getGuildNodeId(guild);
      if (!guildNodeId) continue;

      const membershipCount = Number(guild?.membershipCount ?? 0);
      const ratio = maxMembershipCount > 0 ? membershipCount / maxMembershipCount : 0;
      const guildNodeSize = 14 + ratio * 24;
      const guildKey = String(getGuildDetailId(guild) ?? '');

      addNode({
        id: guildNodeId,
        label: guild?.name ?? `Guild #${guild?.id ?? 'unknown'}`,
        fill: '#f59e0b',
        size: guildNodeSize,
        data: {
          type: 'guild',
          guildId: guildKey || null,
          membershipCount,
        },
      });

      const expandedMemberships = expandedGuildMemberships[guildKey] ?? [];
      for (const membership of expandedMemberships) {
        const makerNodeId = getMakerNodeId(membership);
        if (!makerNodeId) continue;

        const maker = membership?.maker_extended;
        const makerDetailId = maker?.documentId ?? maker?.id ?? null;

        addNode({
          id: makerNodeId,
          label: getMakerLabel(membership),
          fill: '#4f46e5',
          data: {
            type: 'maker',
            makerId: makerDetailId,
          },
        });

        const membershipKey = membership?.id ?? `${guildNodeId}-${makerNodeId}`;
        addEdge({
          id: `membership-${membershipKey}`,
          source: makerNodeId,
          target: guildNodeId,
          label: 'member of',
          data: { type: 'membership' },
        });
      }
    }

    const visibleNodeIds = new Set(
      nodesOut
        .filter((node) => visibleTypes[node?.data?.type] !== false)
        .map((node) => node.id)
    );

    const filteredNodes = nodesOut.filter((node) => visibleNodeIds.has(node.id));
    const filteredEdges = edgesOut.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    const degreeByNodeId = new Map();
    for (const edge of filteredEdges) {
      degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
      degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
    }

    let maxDegree = 0;
    for (const node of filteredNodes) {
      const degree = degreeByNodeId.get(node.id) ?? 0;
      if (degree > maxDegree) maxDegree = degree;
    }

    const minSize = 10;
    const maxSize = 28;

    const scaledNodes = filteredNodes.map((node) => {
      if (node?.data?.type === 'guild') {
        return node;
      }

      const degree = degreeByNodeId.get(node.id) ?? 0;
      const ratio = maxDegree > 0 ? degree / maxDegree : 0;
      return {
        ...node,
        size: minSize + ratio * (maxSize - minSize),
      };
    });

    return {
      nodes: scaledNodes,
      edges: filteredEdges,
    };
  }, [expandedGuildMemberships, guilds, visibleTypes]);

  const toggleGuildMemberships = async (guildId) => {
    const guildKey = String(guildId ?? '');
    if (!guildKey) return;

    setLoadError('');

    if (expandedGuildMemberships[guildKey]) {
      setExpandedGuildMemberships((current) => {
        const next = { ...current };
        delete next[guildKey];
        return next;
      });
      return;
    }

    try {
      setLoadingGuildIds((current) => [...new Set([...current, guildKey])]);

      const response = await requests.guilds.get(guildKey, {
        populate: {
          memberships: {
            populate: {
              maker_extended: true,
            },
          },
        },
      });

      const memberships = Array.isArray(response?.data?.memberships) ? response.data.memberships : [];
      setExpandedGuildMemberships((current) => ({
        ...current,
        [guildKey]: memberships,
      }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load guild memberships.');
    } finally {
      setLoadingGuildIds((current) => current.filter((id) => id !== guildKey));
    }
  };

  const handleNodeClick = (node) => {
    if (node?.data?.type === 'maker' && node?.data?.makerId) {
      router.push(`/data/maker/detail?id=${node.data.makerId}`);
      return;
    }

    if (node?.data?.type === 'guild' && node?.data?.guildId) {
      toggleGuildMemberships(node.data.guildId);
    }
  };

  const toggleType = (type) => {
    setVisibleTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  if (!nodes.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No network nodes to display.</p>;
  }

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Show
        </span>
        {[
          { key: 'guild', label: 'Guilds' },
          { key: 'maker', label: 'Makers' },
        ].map((item) => {
          const active = visibleTypes[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleType(item.key)}
              className={[
                'rounded border px-2 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
              ].join(' ')}
              aria-pressed={active}
            >
              {item.label}
            </button>
          );
        })}

        <p className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {nodes.length} nodes, {edges.length} edges
        </p>
        {loadingGuildIds.length > 0 && (
          <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
            Loading memberships for {loadingGuildIds.length} guild{loadingGuildIds.length === 1 ? '' : 's'}...
          </p>
        )}
        {loadError && (
          <p className="w-full text-xs text-red-600 dark:text-red-400">{loadError}</p>
        )}
        <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
          Click a guild node to load or hide its memberships. Click a maker node to open maker detail.
        </p>
      </div>

      <div className="relative h-[70vh] min-h-[460px] max-h-[760px] w-full min-w-0 max-w-full overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          style={{ width: '100%', height: '100%' }}
          layoutType="forceDirected2d"
          edgeArrowPosition="none"
          labelType="all"
          onNodeClick={handleNodeClick}
          animated
          draggable
          zoomable
          panType="drag"
        />
      </div>
    </section>
  );
}
