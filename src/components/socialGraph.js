
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const GraphCanvas = dynamic(
  () => import('reagraph').then((mod) => mod.GraphCanvas),
  { ssr: false }
);

export default function SocialGraph() {

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);

    const fetchGraphData = async () => {
        try {
            const response = await fetch('http://localhost:1337/api/graph');
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

    return (
    <div className="h-full w-full relative overflow-hidden rounded border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        labelType="all"
        cameraMode="pan"
      />
    </div>
  )
}
