'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

export default function SocialGraph() {
  const router = useRouter();

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);

    const fetchGraphData = async () => {
        try {
            const response = await fetch('http://localhost:1337/api/graph?limit=200');
            const data = await response.json();
            setNodes(data.nodes);
            setEdges(data.edges);
        } catch (error) {
            console.error('Error fetching graph data:', error);
        }
    };

    useEffect(() => {
        fetchGraphData();
    }, []);

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
    <div className="h-180 w-full relative overflow-hidden rounded border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        labelType="all"
        cameraMode="pan"
        onNodeClick={handleNodeClick}
      />
    </div>
  )
}
