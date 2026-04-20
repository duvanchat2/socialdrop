'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, MessageSquare, Reply, Tag, Clock, GitMerge, Bot, Zap } from 'lucide-react';
import Link from 'next/link';

// React Flow is browser-only
const ReactFlowCanvas = dynamic(() => import('./ReactFlowCanvas'), { ssr: false });

interface Flow {
  id: string;
  name: string;
  platform: string;
  trigger: string;
  keyword?: string;
  isActive: boolean;
  nodes: any[];
  edges: any[];
}

const NODE_TYPES = [
  { type: 'TRIGGER', label: 'Trigger', icon: Zap, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  { type: 'SEND_DM', label: 'Enviar DM', icon: MessageSquare, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
  { type: 'SEND_COMMENT', label: 'Responder comentario', icon: Reply, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  { type: 'ADD_TAG', label: 'Agregar tag', icon: Tag, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  { type: 'DELAY', label: 'Delay', icon: Clock, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  { type: 'CONDITION', label: 'Condición', icon: GitMerge, color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' },
  { type: 'AI_REPLY', label: 'Respuesta IA', icon: Bot, color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' },
];

export default function FlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  const { data: flow, isLoading } = useQuery<Flow>({
    queryKey: ['flow', id],
    queryFn: () => apiFetch(`/api/flows/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (flow) {
      setNodes(Array.isArray(flow.nodes) ? flow.nodes : []);
      setEdges(Array.isArray(flow.edges) ? flow.edges : []);
    }
  }, [flow]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/flows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flow', id] }); setDirty(false); },
  });

  const addNode = useCallback(
    (type: string) => {
      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: 100 + nodes.length * 50, y: 100 + nodes.length * 60 },
        data: { label: NODE_TYPES.find(n => n.type === type)?.label ?? type, message: '', tag: '', delayHours: 1 },
      };
      setNodes(prev => [...prev, newNode]);
      setDirty(true);
    },
    [nodes.length],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Cargando flujo...</div>;
  }
  if (!flow) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Flujo no encontrado</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Link href="/flows" className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">{flow.name}</h1>
            <p className="text-xs text-gray-400">{flow.platform} · {flow.trigger}{flow.keyword ? ` · "${flow.keyword}"` : ''}</p>
          </div>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Save size={14} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: node types */}
        <div className="w-52 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Nodos</p>
          <div className="space-y-1.5">
            {NODE_TYPES.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => addNode(type)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 ${color}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative bg-gray-50 dark:bg-gray-950">
          <ReactFlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes: any) => { setNodes(changes); setDirty(true); }}
            onEdgesChange={(changes: any) => { setEdges(changes); setDirty(true); }}
            onNodeClick={(node: any) => setSelectedNode(node)}
          />
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 pointer-events-none">
              <Zap size={32} className="mb-2" />
              <p className="text-sm">Agrega nodos desde el panel izquierdo</p>
            </div>
          )}
        </div>

        {/* Right panel: node config */}
        {selectedNode && (
          <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{selectedNode.data?.label}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">&times;</button>
            </div>
            {(selectedNode.type === 'SEND_DM' || selectedNode.type === 'SEND_COMMENT') && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Mensaje</label>
                <textarea
                  rows={4}
                  defaultValue={selectedNode.data?.message ?? ''}
                  placeholder="Hola {nombre}, gracias por tu mensaje..."
                  onChange={e => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, message: e.target.value } } : n));
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Usa {'{nombre}'} para el nombre del usuario</p>
              </div>
            )}
            {selectedNode.type === 'ADD_TAG' && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tag</label>
                <input
                  type="text"
                  defaultValue={selectedNode.data?.tag ?? ''}
                  placeholder="interesado, cliente, etc."
                  onChange={e => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, tag: e.target.value } } : n));
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            )}
            {selectedNode.type === 'DELAY' && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Esperar (horas)</label>
                <input
                  type="number"
                  min={1}
                  defaultValue={selectedNode.data?.delayHours ?? 1}
                  onChange={e => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, delayHours: Number(e.target.value) } } : n));
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            )}
            {selectedNode.type === 'AI_REPLY' && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Prompt</label>
                <textarea
                  rows={4}
                  defaultValue={selectedNode.data?.prompt ?? ''}
                  placeholder="Responde amablemente a este mensaje..."
                  onChange={e => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, prompt: e.target.value } } : n));
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
