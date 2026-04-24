'use client';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect } from 'react';

// ─── Custom node components ────────────────────────────────────────────────────

function NodeShell({
  label,
  borderColor,
  bgColor,
  textColor,
  children,
}: {
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth: 180,
        maxWidth: 220,
        borderRadius: 12,
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        color: textColor,
        fontSize: 13,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />
      <div style={{ padding: '8px 12px', fontWeight: 600 }}>{label}</div>
      {children && (
        <div
          style={{
            padding: '4px 12px 8px',
            fontSize: 11,
            opacity: 0.7,
            borderTop: `1px solid ${borderColor}33`,
          }}
        >
          {children}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}

function TriggerNode({ data }: NodeProps) {
  return (
    <NodeShell label={`⚡ ${String(data?.label ?? 'Trigger')}`} borderColor="#f59e0b" bgColor="#fffbeb" textColor="#92400e">
      {data?.keyword ? <span>keyword: &quot;{String(data.keyword)}&quot;</span> : null}
    </NodeShell>
  );
}
function SendDmNode({ data }: NodeProps) {
  return (
    <NodeShell label={`💬 ${String(data?.label ?? 'Enviar DM')}`} borderColor="#6366f1" bgColor="#eef2ff" textColor="#3730a3">
      {data?.message ? <span>{String(data.message).slice(0, 50)}{String(data.message).length > 50 ? '…' : ''}</span> : null}
    </NodeShell>
  );
}
function SendCommentNode({ data }: NodeProps) {
  return (
    <NodeShell label={`↩️ ${String(data?.label ?? 'Responder')}`} borderColor="#a855f7" bgColor="#faf5ff" textColor="#6b21a8">
      {data?.message ? <span>{String(data.message).slice(0, 50)}{String(data.message).length > 50 ? '…' : ''}</span> : null}
    </NodeShell>
  );
}
function AddTagNode({ data }: NodeProps) {
  return (
    <NodeShell label={`🏷️ ${String(data?.label ?? 'Agregar tag')}`} borderColor="#22c55e" bgColor="#f0fdf4" textColor="#14532d">
      {data?.tag ? <span>tag: {String(data.tag)}</span> : null}
    </NodeShell>
  );
}
function DelayNode({ data }: NodeProps) {
  return (
    <NodeShell label={`⏱️ ${String(data?.label ?? 'Delay')}`} borderColor="#f97316" bgColor="#fff7ed" textColor="#7c2d12">
      <span>esperar {String(data?.delayHours ?? 1)}h</span>
    </NodeShell>
  );
}
function ConditionNode({ data }: NodeProps) {
  return (
    <NodeShell label={`🔀 ${String(data?.label ?? 'Condición')}`} borderColor="#ec4899" bgColor="#fdf2f8" textColor="#831843" />
  );
}
function AiReplyNode({ data }: NodeProps) {
  return (
    <NodeShell label={`🤖 ${String(data?.label ?? 'Respuesta IA')}`} borderColor="#06b6d4" bgColor="#ecfeff" textColor="#164e63">
      {data?.prompt ? <span>{String(data.prompt).slice(0, 50)}{String(data.prompt).length > 50 ? '…' : ''}</span> : null}
    </NodeShell>
  );
}

const NODE_TYPE_MAP = {
  TRIGGER: TriggerNode,
  SEND_DM: SendDmNode,
  SEND_COMMENT: SendCommentNode,
  ADD_TAG: AddTagNode,
  DELAY: DelayNode,
  CONDITION: ConditionNode,
  AI_REPLY: AiReplyNode,
};

// ─── Canvas ────────────────────────────────────────────────────────────────────

interface Props {
  nodes: any[];
  edges: any[];
  onNodesChange: (nodes: any[]) => void;
  onEdgesChange: (edges: any[]) => void;
  onNodeClick: (node: any) => void;
}

export default function ReactFlowCanvas({
  nodes: initNodes,
  edges: initEdges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: Props) {
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
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPE_MAP}
        onNodesChange={(changes) => {
          handleNodesChange(changes);
          setNodes(prev => { onNodesChange(prev); return prev; });
        }}
        onEdgesChange={(changes) => {
          handleEdgesChange(changes);
          setEdges(prev => { onEdgesChange(prev); return prev; });
        }}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node)}
        fitView
        style={{ width: '100%', height: '100%' }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
