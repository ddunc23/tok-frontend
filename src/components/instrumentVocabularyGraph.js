'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

function buildNodeSize(count, maxCount) {
  const minSize = 10;
  const maxSize = 36;
  if (!Number.isFinite(count) || count <= 0 || maxCount <= 0) return minSize;
  const ratio = count / maxCount;
  return minSize + ratio * (maxSize - minSize);
}

export default function InstrumentVocabularyGraph({ instrumentOptions = [] }) {
  const router = useRouter();
  const [showRelatedEdges, setShowRelatedEdges] = useState(false);
  const [hideZeroCountNodes, setHideZeroCountNodes] = useState(false);
  const [expandedTermIds, setExpandedTermIds] = useState([]);

  const { nodes, edges, childrenByParent } = useMemo(() => {
    const options = Array.isArray(instrumentOptions) ? instrumentOptions : [];

    const eligibleOptions = hideZeroCountNodes
      ? options.filter((item) => (item?.count ?? 0) > 0)
      : options;

    const optionById = new Map();
    for (const option of eligibleOptions) {
      const id = Number(option?.id);
      if (Number.isFinite(id)) {
        optionById.set(id, option);
      }
    }

    const topLevelOptions = eligibleOptions.filter((item) => {
      const broader = Array.isArray(item?.broaderTerms) ? item.broaderTerms : [];
      return broader.length === 0;
    });

    const children = new Map();
    for (const option of eligibleOptions) {
      const childId = Number(option?.id);
      if (!Number.isFinite(childId)) continue;

      for (const broader of option?.broaderTerms ?? []) {
        const parentId = Number(broader?.id);
        if (!Number.isFinite(parentId)) continue;
        if (!optionById.has(parentId)) continue;

        const bucket = children.get(parentId) ?? [];
        bucket.push(childId);
        children.set(parentId, bucket);
      }
    }

    const expandedSet = new Set(expandedTermIds.map((value) => Number(value)).filter((id) => Number.isFinite(id)));
    const visibleIds = new Set(
      topLevelOptions
        .map((item) => Number(item?.id))
        .filter((id) => Number.isFinite(id))
    );

    const queue = [...visibleIds];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!expandedSet.has(currentId)) continue;

      const currentChildren = children.get(currentId) ?? [];
      for (const childId of currentChildren) {
        if (visibleIds.has(childId)) continue;
        visibleIds.add(childId);
        queue.push(childId);
      }
    }

    const visibleOptions = [...visibleIds]
      .map((id) => optionById.get(id))
      .filter(Boolean);

    const optionIds = new Set(
      visibleOptions
        .map((item) => Number(item?.id))
        .filter((id) => Number.isFinite(id))
    );

    let maxCount = 0;
    for (const option of visibleOptions) {
      const count = Number(option?.count ?? 0);
      if (count > maxCount) maxCount = count;
    }

    const nodesOut = visibleOptions.map((option) => {
      const termId = Number(option?.id);
      const count = Number(option?.count ?? 0);
      const label = String(option?.label ?? `Instrument #${termId}`);
      const size = buildNodeSize(count, maxCount);

      return {
        id: `instrument-${termId}`,
        label,
        size,
        fill: count > 0 ? '#0f766e' : '#64748b',
        data: {
          type: 'instrument',
          termId,
          count,
          knownCount: Number(option?.knownCount ?? 0),
          advertisedCount: Number(option?.advertisedCount ?? 0),
        },
      };
    });

    const seenEdges = new Set();
    const edgesOut = [];

    const addEdge = (sourceId, targetId, label, edgeType = 'broader') => {
      const key = `${sourceId}->${targetId}|${label}|${edgeType}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edgesOut.push({
        id: key,
        source: sourceId,
        target: targetId,
        label,
        data: { edgeType },
      });
    };

    for (const option of visibleOptions) {
      const sourceTermId = Number(option?.id);
      const sourceNodeId = `instrument-${sourceTermId}`;

      for (const broader of option?.broaderTerms ?? []) {
        const broaderTermId = Number(broader?.id);
        if (!Number.isFinite(broaderTermId)) continue;
        if (!optionIds.has(broaderTermId)) continue;

        const targetNodeId = `instrument-${broaderTermId}`;
        addEdge(sourceNodeId, targetNodeId, 'broader than', 'broader');
      }

      if (!showRelatedEdges) continue;

      for (const related of option?.relatedTerms ?? []) {
        const relatedTermId = Number(related?.id);
        if (!Number.isFinite(relatedTermId)) continue;
        if (!optionIds.has(relatedTermId)) continue;

        const targetNodeId = `instrument-${relatedTermId}`;
        addEdge(sourceNodeId, targetNodeId, 'related to', 'related');
      }
    }

    return { nodes: nodesOut, edges: edgesOut, childrenByParent: children };
  }, [expandedTermIds, hideZeroCountNodes, instrumentOptions, showRelatedEdges]);

  const handleNodeClick = (node) => {
    const termId = Number(node?.data?.termId);
    if (!Number.isFinite(termId)) return;

    const hasChildren = (childrenByParent.get(termId) ?? []).length > 0;
    if (!hasChildren) {
      router.push(`/data/instrument/detail?id=${termId}`);
      return;
    }

    setExpandedTermIds((current) => {
      const currentSet = new Set(current);
      if (currentSet.has(termId)) {
        currentSet.delete(termId);
      } else {
        currentSet.add(termId);
      }
      return [...currentSet];
    });
  };

  return (
    <section className="flex h-[calc(100vh-14rem)] min-h-[520px] w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showRelatedEdges}
            onChange={(event) => setShowRelatedEdges(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-400 accent-zinc-700 dark:accent-zinc-300"
          />
          Show related-term edges
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={hideZeroCountNodes}
            onChange={(event) => setHideZeroCountNodes(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-400 accent-zinc-700 dark:accent-zinc-300"
          />
          Hide zero-maker terms
        </label>

        <p className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {nodes.length} nodes, {edges.length} edges
        </p>
        <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
          Click a node to expand or collapse its narrower terms.
        </p>
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
