'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { requests } from '@/utils/requests';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

export default function MakerResultsNetwork({ makers = [] }) {
  const router = useRouter();
  const [visibleTypes, setVisibleTypes] = useState({
    maker: true,
    guild: true,
    town: true,
    instrument: true,
  });
  const [expandedMakers, setExpandedMakers] = useState([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState('');

  const getMakerId = (maker) => maker?.documentId ?? maker?.id ?? null;
  const getMakerLabel = (maker) =>
    maker?.Label ||
    [maker?.First_name ?? maker?.first_name, maker?.Surname ?? maker?.surname].filter(Boolean).join(' ') ||
    maker?.Organisation_Name ||
    `Maker #${maker?.id ?? 'unknown'}`;

  const handleExpandGraph = async () => {
    try {
      setIsExpanding(true);
      setExpandError('');

      const baseRows = Array.isArray(makers) ? makers : [];
      const baseMakerIds = new Set(baseRows.map((row) => String(getMakerId(row))).filter(Boolean));
      const expandedIds = new Set(expandedMakers.map((row) => String(getMakerId(row))).filter(Boolean));
      const idsToFetch = new Set();

      for (const maker of baseRows) {
        for (const relation of maker?.relations ?? []) {
          const targetMaker = relation?.target_maker_extended ?? relation?.target_maker;
          const targetId = getMakerId(targetMaker);
          const key = String(targetId ?? '');
          if (!key || baseMakerIds.has(key) || expandedIds.has(key)) continue;
          idsToFetch.add(key);
        }

        for (const relationTarget of maker?.relation_targets ?? []) {
          const sourceMaker = relationTarget?.maker_extended ?? relationTarget?.maker;
          const sourceId = getMakerId(sourceMaker);
          const key = String(sourceId ?? '');
          if (!key || baseMakerIds.has(key) || expandedIds.has(key)) continue;
          idsToFetch.add(key);
        }
      }

      if (idsToFetch.size === 0) {
        setExpandError('No additional linked makers to expand.');
        return;
      }

      const responses = await Promise.all(
        [...idsToFetch].map((makerId) =>
          requests.makersExtended.get(makerId, {
            populate: {
              relations: { populate: { target_maker_extended: true, relation_type: true } },
              relation_targets: { populate: { maker_extended: true, relation_type: true } },
            },
          })
        )
      );

      const fetched = responses.map((response) => response?.data).filter((row) => !!getMakerId(row));

      setExpandedMakers((current) => {
        const merged = [...current];
        const seen = new Set(merged.map((row) => String(getMakerId(row))).filter(Boolean));
        for (const row of fetched) {
          const key = String(getMakerId(row));
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(row);
        }
        return merged;
      });
    } catch (error) {
      setExpandError(error instanceof Error ? error.message : 'Error expanding network.');
    } finally {
      setIsExpanding(false);
    }
  };

  const { nodes, edges } = useMemo(() => {
    const rows = Array.isArray(makers) ? makers : [];
    const combinedRows = [...rows, ...expandedMakers];

    const nodesOut = [];
    const edgesOut = [];
    const seenNodeIds = new Set();
    const seenEdgeKeys = new Set();

    const resultMakerDocumentIds = new Set(
      rows.map((maker) => String(maker?.documentId ?? maker?.id ?? '')).filter(Boolean)
    );
    const expandedMakerIds = new Set(
      expandedMakers.map((maker) => String(maker?.documentId ?? maker?.id ?? '')).filter(Boolean)
    );

    const addNode = (node) => {
      if (!node?.id || seenNodeIds.has(node.id)) return;
      seenNodeIds.add(node.id);
      nodesOut.push({ draggable: true, ...node });
    };

    const addEdge = ({ source, target, label, edgeType }) => {
      if (!source || !target) return;
      const key = `${source}->${target}|${label ?? ''}|${edgeType ?? ''}`;
      if (seenEdgeKeys.has(key)) return;
      seenEdgeKeys.add(key);
      edgesOut.push({ id: key, source, target, label, data: { edgeType } });
    };

    const normalizeInstrumentLabel = (value) => {
      if (!value) return null;
      const normalized = String(value).replace(/,\s*$/, '').trim();
      return normalized || null;
    };

    for (const maker of combinedRows) {
      const makerId = getMakerId(maker);
      if (!makerId) continue;

      const makerNodeId = `maker-${makerId}`;
      const makerIdKey = String(makerId);
      const makerFill = resultMakerDocumentIds.has(makerIdKey)
        ? '#4f46e5'
        : expandedMakerIds.has(makerIdKey)
          ? '#93c5fd'
          : '#3b82f6';

      addNode({
        id: makerNodeId,
        label: getMakerLabel(maker),
        fill: makerFill,
        data: { type: 'maker', makerId },
      });

      for (const relation of maker?.relations ?? []) {
        const targetMaker = relation?.target_maker_extended ?? relation?.target_maker;
        const targetId = getMakerId(targetMaker);
        if (!targetId) continue;

        const targetNodeId = `maker-${targetId}`;
        const isInResults = resultMakerDocumentIds.has(String(targetId));
        addNode({
          id: targetNodeId,
          label: getMakerLabel(targetMaker),
          fill: isInResults ? '#4f46e5' : '#3b82f6',
          data: { type: 'maker', makerId: targetId },
        });

        addEdge({
          source: makerNodeId,
          target: targetNodeId,
          label: relation?.relation_type?.name ?? relation?.relation_description ?? 'relation',
          edgeType: 'relation',
        });
      }

      for (const relationTarget of maker?.relation_targets ?? []) {
        const sourceMaker = relationTarget?.maker_extended ?? relationTarget?.maker;
        const sourceId = getMakerId(sourceMaker);
        if (!sourceId) continue;

        const sourceNodeId = `maker-${sourceId}`;
        const isInResults = resultMakerDocumentIds.has(String(sourceId));
        addNode({
          id: sourceNodeId,
          label: getMakerLabel(sourceMaker),
          fill: isInResults ? '#4f46e5' : '#3b82f6',
          data: { type: 'maker', makerId: sourceId },
        });

        addEdge({
          source: sourceNodeId,
          target: makerNodeId,
          label: relationTarget?.relation_type?.name ?? relationTarget?.relation_description ?? 'relation',
          edgeType: 'relation',
        });
      }

      for (const membership of maker?.memberships ?? []) {
        const guild = membership?.guild;
        if (!guild?.id) continue;

        const guildNodeId = `guild-${guild.id}`;
        addNode({
          id: guildNodeId,
          label: guild?.name ?? `Guild #${guild.id}`,
          fill: '#f59e0b',
          data: { type: 'guild', guildId: guild.id },
        });

        addEdge({ source: makerNodeId, target: guildNodeId, label: 'member of', edgeType: 'guild' });
      }

      for (const address of maker?.addresses ?? []) {
        const town = address?.town_location;
        if (!town?.id) continue;

        const townNodeId = `town-${town.id}`;
        addNode({
          id: townNodeId,
          label: town?.town ?? town?.name ?? `Town #${town.id}`,
          fill: '#10b981',
          data: { type: 'town', townId: town.id },
        });

        addEdge({ source: makerNodeId, target: townNodeId, label: 'located in', edgeType: 'town' });
      }

      for (const association of maker?.term_associations ?? []) {
        const term = association?.term;
        const termId = Number(term?.id);
        if (!Number.isFinite(termId)) continue;

        const label = normalizeInstrumentLabel(
          term?.preferred_label ?? term?.preferred_term ?? term?.name ?? association?.evidence_label
        );
        if (!label) continue;

        const instrumentNodeId = `instrument-${termId}`;
        addNode({
          id: instrumentNodeId,
          label,
          fill: '#e11d48',
          data: { type: 'instrument', termId },
        });

        const associationType = String(association?.association_type ?? '').toUpperCase();
        const relationLabel = associationType === 'ADVERTISED' ? 'advertised' : associationType === 'KNOWN' ? 'known for' : 'associated with';
        addEdge({ source: makerNodeId, target: instrumentNodeId, label: relationLabel, edgeType: 'instrument' });
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
    const maxSize = 30;

    const scaledNodes = filteredNodes.map((node) => {
      const degree = degreeByNodeId.get(node.id) ?? 0;
      const ratio = maxDegree > 0 ? degree / maxDegree : 0;
      const size = minSize + ratio * (maxSize - minSize);

      return {
        ...node,
        size,
      };
    });

    return {
      nodes: scaledNodes,
      edges: filteredEdges,
    };
  }, [expandedMakers, makers, visibleTypes]);

  const toggleType = (type) => {
    setVisibleTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  const handleNodeClick = (node) => {
    if (node?.data?.type === 'maker' && node?.data?.makerId) {
      router.push(`/data/maker/detail?id=${node.data.makerId}`);
      return;
    }

    if (node?.data?.type === 'instrument' && node?.data?.termId) {
      router.push(`/data/instrument/detail?id=${node.data.termId}`);
    }
  };

  if (!nodes.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No network nodes to display.</p>;
  }

  return (
    <section className="flex h-[calc(100vh-14rem)] min-h-[520px] w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={handleExpandGraph}
          disabled={isExpanding}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {isExpanding ? 'Expanding...' : 'Expand by 1 degree'}
        </button>

        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Show
        </span>
        {[
          { key: 'maker', label: 'Makers' },
          { key: 'guild', label: 'Guilds' },
          { key: 'town', label: 'Towns' },
          { key: 'instrument', label: 'Instruments' },
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
        {expandError && (
          <p className="w-full text-xs text-amber-600 dark:text-amber-400">{expandError}</p>
        )}
        {expandedMakers.length > 0 && (
          <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
            {expandedMakers.length} linked maker{expandedMakers.length === 1 ? '' : 's'} expanded.
          </p>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          labelType="all"
          cameraMode="pan"
          draggable
          onNodeClick={handleNodeClick}
        />
      </div>
    </section>
  );
}
