'use client';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect } from 'react';

interface Props {
  nodes: any[];
  edges: any[];
  onNodesChange: (nodes: any[]) => void;
  onEdgesChange: (edges: any[]) => void;
  onNodeClick: (node: any) => void;
}

export default function ReactFlowCanvas({ nodes: initNodes, edges: initEdges, onNodesChange, onEdgesChange, onNodeClick }: Props) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initEdges);

  useEffect(() => { setNodes(initNodes); }, [initNodes, setNodes]);
  useEffect(() => { setEdges(initEdges); }, [initEdges, setEdges]);

  const onConnect = useCallback(
    (params: any) => {
      const next = addEdge(params, edges);
      setEdges(next);
      onEdgesChange(next);
    },
    [edges, setEdges, onEdgesChange],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={(changes) => {
        handleNodesChange(changes);
        // propagate updated nodes after change
        setNodes(prev => { onNodesChange(prev); return prev; });
      }}
      onEdgesChange={(changes) => {
        handleEdgesChange(changes);
        setEdges(prev => { onEdgesChange(prev); return prev; });
      }}
      onConnect={onConnect}
      onNodeClick={(_, node) => onNodeClick(node)}
      fitView
      className="bg-gray-50 dark:bg-gray-950"
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
