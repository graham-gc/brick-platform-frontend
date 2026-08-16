'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App as AntdApp, Button, Space, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type Viewport,
} from '@xyflow/react';
import type { BrickFlow, BrickFlowEdge, BrickFlowNode, EndpointDefinition } from '@/types';
import { EndpointPalette } from './EndpointPalette';
import { HttpFlowNode } from './HttpFlowNode';
import { NodeEditorModal } from './NodeEditorModal';
import { createInitialNodeRequest } from './request-definition';
import type { FlowCanvasEdge, FlowCanvasSavePayload, HttpCanvasNode } from './model';
import styles from './flow-designer.module.css';

const nodeTypes = { http: HttpFlowNode };
const ENDPOINT_DRAG_TYPE = 'application/brick-endpoint';
const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  active: 'green',
  disabled: 'red',
};

interface FlowDesignerProps {
  flow: BrickFlow;
  persistedNodes: BrickFlowNode[];
  persistedEdges: BrickFlowEdge[];
  endpoints: EndpointDefinition[];
  saving: boolean;
  running: boolean;
  titleContent?: ReactNode;
  headerContent?: ReactNode;
  onBack: () => void;
  onRun?: () => void;
  onSave: (payload: FlowCanvasSavePayload) => Promise<void>;
}

function createsCycle(source: string, target: string, edges: FlowCanvasEdge[]) {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.source) || [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }

  const pending = [target];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(outgoing.get(current) || []));
  }
  return false;
}

function allocateNegativeTimestamp(reference: { current: number }) {
  const timestamp = -Date.now();
  reference.current = reference.current === 0
    ? timestamp
    : Math.min(timestamp, reference.current - 1);
  return reference.current;
}

function FlowDesignerCanvas({
  flow,
  persistedNodes,
  persistedEdges,
  endpoints,
  saving,
  running,
  titleContent,
  headerContent,
  onBack,
  onRun,
  onSave,
}: FlowDesignerProps) {
  const { message } = AntdApp.useApp();
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextTempNodeId = useRef(0);
  const nextTempEdgeId = useRef(0);
  const viewportInteraction = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string>();
  const hasUnsavedChanges = flow.id == null || dirty;
  const { screenToFlowPosition, getViewport } = useReactFlow<HttpCanvasNode, FlowCanvasEdge>();

  const endpointsById = useMemo(
    () => new Map(endpoints.filter((endpoint) => endpoint.id != null).map((endpoint) => [endpoint.id!, endpoint])),
    [endpoints]
  );

  const initialNodes = useMemo<HttpCanvasNode[]>(() => persistedNodes.map((node, index) => {
    const endpoint = node.endpointId == null ? undefined : endpointsById.get(node.endpointId);
    return {
      id: String(node.id ?? -(index + 1)),
      type: 'http',
      position: {
        x: node.x ?? 120 + (index % 4) * 260,
        y: node.y ?? 100 + Math.floor(index / 4) * 180,
      },
      data: {
        endpointId: node.endpointId,
        method: endpoint?.httpMethod || 'HTTP',
        path: endpoint?.endpointPath || `Endpoint ${node.endpointId ?? ''}`,
        label: endpoint?.summary || endpoint?.operationId || endpoint?.endpointPath || 'HTTP request',
        endpoint,
        flowNode: node,
      },
    };
  }), [endpointsById, persistedNodes]);

  const initialEdges = useMemo<FlowCanvasEdge[]>(() => persistedEdges.map((edge, index) => ({
    id: edge.id == null ? `restored-edge-${index}` : String(edge.id),
    source: String(edge.sourceNodeId),
    target: String(edge.targetNodeId),
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { flowEdge: edge },
  })), [persistedEdges]);

  const [nodes, setNodes] = useState<HttpCanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowCanvasEdge[]>(initialEdges);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const addEndpointNode = useCallback((endpoint: EndpointDefinition, position: { x: number; y: number }) => {
    const temporaryId = allocateNegativeTimestamp(nextTempNodeId);
    const newNode: HttpCanvasNode = {
      id: String(temporaryId),
      type: 'http',
      position,
      data: {
        endpointId: endpoint.id,
        method: endpoint.httpMethod || 'HTTP',
        path: endpoint.endpointPath || '',
        label: endpoint.summary || endpoint.operationId || endpoint.endpointPath || 'HTTP request',
        endpoint,
        flowNode: {
          ...createInitialNodeRequest(endpoint),
          id: temporaryId,
          flowId: flow.id,
          endpointId: endpoint.id,
          timeoutSec: 30,
          retries: 0,
          nodeType: 'http',
          x: position.x,
          y: position.y,
        },
      },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
    setDirty(true);
  }, [flow.id]);

  const handleQuickAdd = useCallback((endpoint: EndpointDefinition) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const screenPosition = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    addEndpointNode(endpoint, screenToFlowPosition(screenPosition));
  }, [addEndpointNode, screenToFlowPosition]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const endpointId = Number(event.dataTransfer.getData(ENDPOINT_DRAG_TYPE));
    const endpoint = endpointsById.get(endpointId);
    if (!endpoint) return;
    addEndpointNode(endpoint, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [addEndpointNode, endpointsById, screenToFlowPosition]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleNodesChange = useCallback((changes: NodeChange<HttpCanvasNode>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    if (changes.some((change) => change.type === 'position' || change.type === 'remove')) {
      setDirty(true);
    }
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange<FlowCanvasEdge>[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
    if (changes.some((change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace')) {
      setDirty(true);
    }
  }, []);

  const isValidConnection = useCallback((connection: Connection | FlowCanvasEdge) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return false;
    if (edges.some((edge) => edge.source === source && edge.target === target)) return false;
    return !createsCycle(source, target, edges);
  }, [edges]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) return;
    const edgeId = allocateNegativeTimestamp(nextTempEdgeId);
    setEdges((currentEdges) => addEdge({
      ...connection,
      id: String(edgeId),
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        flowEdge: {
          id: edgeId,
          flowId: flow.id,
          sourceNodeId: Number(connection.source),
          targetNodeId: Number(connection.target),
          edgeType: 'default',
        },
      },
    }, currentEdges));
    setDirty(true);
  }, [flow.id, isValidConnection]);

  const handleNodesDelete = useCallback((deletedNodes: HttpCanvasNode[]) => {
    const deletedIds = new Set(deletedNodes.map((node) => node.id));
    setEdges((currentEdges) => currentEdges.filter(
      (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)
    ));
    setDirty(true);
  }, []);

  const handleNodeDoubleClick: NodeMouseHandler<HttpCanvasNode> = useCallback((_event, node) => {
    setEditingNodeId(node.id);
  }, []);

  const handleNodeEditorSave = (updates: Partial<BrickFlowNode>) => {
    if (!editingNodeId) return;
    setNodes((currentNodes) => currentNodes.map((node) => node.id === editingNodeId
      ? {
          ...node,
          data: {
            ...node.data,
            flowNode: { ...node.data.flowNode, ...updates },
          },
        }
      : node));
    setEditingNodeId(undefined);
    setDirty(true);
  };

  const handleSave = async () => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const hasDanglingEdge = edges.some(
      (edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
    );
    if (hasDanglingEdge) {
      message.error('The flow contains a connection to a missing node');
      return;
    }

    const payload: FlowCanvasSavePayload = {
      nodes: nodes.map((node) => ({
        ...node.data.flowNode,
        id: Number(node.id),
        flowId: flow.id,
        endpointId: node.data.endpointId,
        x: node.position.x,
        y: node.position.y,
      })),
      edges: edges.map((edge) => ({
        ...edge.data?.flowEdge,
        id: Number.isFinite(Number(edge.id)) ? Number(edge.id) : undefined,
        flowId: flow.id,
        sourceNodeId: Number(edge.source),
        targetNodeId: Number(edge.target),
        edgeType: edge.data?.flowEdge.edgeType || 'default',
      })),
      viewport: getViewport(),
    };

    try {
      await onSave(payload);
      setDirty(false);
    } catch {
      // The page-level mutation reports the API error through Ant Design message.
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved flow changes?')) return;
    onBack();
  };

  const initialViewport: Viewport = {
    x: flow.viewportX ?? 0,
    y: flow.viewportY ?? 0,
    zoom: flow.viewportZoom ?? 1,
  };
  const hasSavedViewport = flow.viewportX != null && flow.viewportY != null && flow.viewportZoom != null;

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarIdentity}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>Back</Button>
          <div className={styles.flowTitleBlock}>
            {titleContent || <h2>{flow.name}</h2>}
            <Space size={6} wrap>
              <Tag color={STATUS_COLORS[flow.status || 'draft']}>{flow.status || 'draft'}</Tag>
              {hasUnsavedChanges && <Tag color="orange">Unsaved changes</Tag>}
            </Space>
          </div>
        </div>
        <Space wrap>
          {flow.id != null && onRun && (
            <Tooltip title={dirty ? 'Save the canvas before running it' : 'Run the saved flow'}>
              <span>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={onRun}
                  loading={running}
                  disabled={dirty}
                >
                  Run
                </Button>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Save nodes, connections, positions and viewport">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => void handleSave()}
              loading={saving}
            >
              Save
            </Button>
          </Tooltip>
        </Space>
      </header>

      {headerContent}

      <div className={styles.designerShell}>
        <EndpointPalette endpoints={endpoints} onQuickAdd={handleQuickAdd} />
        <div className={styles.canvasPanel} ref={canvasRef}>
          <ReactFlow<HttpCanvasNode, FlowCanvasEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodesDelete={handleNodesDelete}
            onNodeDoubleClick={handleNodeDoubleClick}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMoveStart={(event) => {
              if (event) viewportInteraction.current = true;
            }}
            onMoveEnd={() => {
              if (!viewportInteraction.current) return;
              viewportInteraction.current = false;
              setDirty(true);
            }}
            defaultViewport={initialViewport}
            fitView={!hasSavedViewport && nodes.length > 0}
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={0.25}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <MiniMap pannable zoomable />
            <Controls showInteractive={false} />
            {nodes.length === 0 && (
              <Panel position="top-center">
              <div className={styles.emptyCanvas}>
                Drag an endpoint here or use the + button to create the first node
              </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {editingNodeId && (() => {
        const editingNode = nodes.find((node) => node.id === editingNodeId);
        return editingNode ? (
          <NodeEditorModal
            key={editingNode.id}
            node={editingNode}
            onCancel={() => setEditingNodeId(undefined)}
            onSave={handleNodeEditorSave}
          />
        ) : null;
      })()}
    </div>
  );
}

export function FlowDesigner(props: FlowDesignerProps) {
  return (
    <ReactFlowProvider>
      <FlowDesignerCanvas {...props} />
    </ReactFlowProvider>
  );
}
