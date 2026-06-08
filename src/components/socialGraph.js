'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo } from 'react';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

export default function SocialGraph() {
  const router = useRouter();

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [limitInput, setLimitInput] = useState(200);
    const [maxDepthInput, setMaxDepthInput] = useState(5);
    const [limit, setLimit] = useState(200);
    const [maxDepth, setMaxDepth] = useState(5);

    const fetchGraphData = async (nextLimit, nextMaxDepth) => {
        try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/graph?limit=${nextLimit}&maxDepth=${nextMaxDepth}`
            );
            const data = await response.json();
            setNodes(data.nodes);
            setEdges(data.edges);
        } catch (error) {
            console.error('Error fetching graph data:', error);
        }
    };

    useEffect(() => {
        fetchGraphData(limit, maxDepth);
    }, [limit, maxDepth]);

    const handleLimitChange = (event) => {
      const value = Number.parseInt(event.target.value, 10);
      if (Number.isNaN(value)) return;
      setLimitInput(Math.max(1, value));
    };

    const handleMaxDepthChange = (event) => {
      const value = Number.parseInt(event.target.value, 10);
      if (Number.isNaN(value)) return;
      setMaxDepthInput(Math.max(1, value));
    };

    const handleApply = () => {
      setLimit(limitInput);
      setMaxDepth(maxDepthInput);
    };

    const scaledNodes = useMemo(() => {
      if (!nodes.length) return [];

      const degreeById = new Map();

      for (const edge of edges) {
        const sourceId = String(edge?.source ?? '');
        const targetId = String(edge?.target ?? '');

        if (sourceId) {
          degreeById.set(sourceId, (degreeById.get(sourceId) ?? 0) + 1);
        }
        if (targetId) {
          degreeById.set(targetId, (degreeById.get(targetId) ?? 0) + 1);
        }
      }

      let maxDegree = 0;
      for (const node of nodes) {
        const nodeId = String(node?.id ?? '');
        const degree = degreeById.get(nodeId) ?? 0;
        if (degree > maxDegree) maxDegree = degree;
      }

      const minSize = 8;
      const maxSize = 28;

      return nodes.map((node) => {
        const nodeId = String(node?.id ?? '');
        const degree = degreeById.get(nodeId) ?? 0;
        const ratio = maxDegree > 0 ? degree / maxDegree : 0;
        const size = minSize + ratio * (maxSize - minSize);

        return {
          ...node,
          size,
        };
      });
    }, [nodes, edges]);

    const handleNodeClick = (node) => {
      const directMakerId = node?.data?.makerId ?? node?.data?.documentId ?? node?.data?.id;

      if (directMakerId != null) {
        router.push(`/data/maker/detail?id=${directMakerId}`);
        return;
      }

      const nodeId = String(node?.id ?? '');
      if (nodeId.startsWith('maker-')) {
        const makerId = nodeId.slice('maker-'.length);
        if (makerId) {
          router.push(`/data/maker/detail?id=${makerId}`);
        }
      }
    };

    return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
        <GraphCanvas
          nodes={scaledNodes}
          edges={edges}
          labelType="all"
          cameraMode="pan"
          onNodeClick={handleNodeClick}
        />
      </div>

      <div className="shrink-0 flex flex-wrap items-end gap-3 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Limit
          <input
            type="number"
            min={1}
            value={limitInput}
            onChange={handleLimitChange}
            className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Max depth
          <input
            type="number"
            min={1}
            value={maxDepthInput}
            onChange={handleMaxDepthChange}
            className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <button
          type="button"
          onClick={handleApply}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
