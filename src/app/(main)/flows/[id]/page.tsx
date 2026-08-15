'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Card, Button, Space, Spin, Tag, Modal, Form, Input, Select } from 'antd';
import { SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import * as api from '@/services/api';
import type { BrickFlow, BrickFlowNode, BrickFlowEdge, EndpointDefinition } from '@/types';
import { useBrickStore } from '@/stores';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  active: 'green',
  disabled: 'red',
};

export default function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = AntdApp.useApp();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const flowId = parseInt(id);

  const {
    flowNodes,
    setFlowNodes,
    flowEdges,
    setFlowEdges,
    addFlowNode,
    updateFlowNode,
    removeFlowNode,
    addFlowEdge,
    removeFlowEdge,
  } = useBrickStore();

  const [nodes, setNodes] = useState<Array<{ id: number; x: number; y: number; label: string; method?: string; path?: string }>>([]);
  const [edges, setEdges] = useState<Array<{ id: number; source: number; target: number }>>([]);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [nodeForm] = Form.useForm();
  const [runLoading, setRunLoading] = useState(false);

  // Load flow details
  const { data: flowDetail, isLoading } = useQuery({
    queryKey: ['flow-detail', flowId],
    queryFn: () => api.getFlowDetail(flowId),
  });

  // Load endpoint definitions
  const { data: endpoints } = useQuery({
    queryKey: ['endpoints', flowDetail?.flow?.swaggerMappingId],
    queryFn: () => api.getAllEndpoints(flowDetail!.flow!.swaggerMappingId!),
    enabled: !!flowDetail?.flow?.swaggerMappingId,
  });

  // Synchronize store data with local visual state
  useEffect(() => {
    if (flowDetail?.nodes) {
      setFlowNodes(flowDetail.nodes);
      setFlowEdges(flowDetail.edges);
      // Convert persisted nodes into visual nodes
      const visualNodes = flowDetail.nodes.map((n, i) => ({
        id: n.id!,
        x: n.x || 100 + i * 200,
        y: n.y || 200,
        label: n.endpointId ? `Endpoint ${n.endpointId}` : 'Node',
        method: (n as any).httpMethod,
        path: (n as any).endpointPath,
      }));
      setNodes(visualNodes);
      const visualEdges = flowDetail.edges.map((e) => ({
        id: e.id!,
        source: e.sourceNodeId!,
        target: e.targetNodeId!,
      }));
      setEdges(visualEdges);
    }
  }, [flowDetail, setFlowNodes, setFlowEdges]);

  // Save the flow
  const saveMutation = useMutation({
    mutationFn: () => {
      const updatedFlow = flowDetail?.flow;
      return api.updateFlow({
        flow: updatedFlow!,
        nodes: flowNodes,
        edges: flowEdges,
        operator: 'admin',
      });
    },
    onSuccess: () => {
      message.success('Saved successfully');
      queryClient.invalidateQueries({ queryKey: ['flow-detail', flowId] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Run the flow
  const runMutation = useMutation({
    mutationFn: () => api.runFlow(flowId, 'admin'),
    onSuccess: () => {
      message.success('Flow started');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Add a node
  const handleAddNode = (endpoint: EndpointDefinition) => {
    const newId = Date.now();
    const newNode = {
      id: newId,
      x: 100 + nodes.length * 200,
      y: 200,
      label: endpoint.summary || endpoint.endpointPath || 'Unknown node',
      method: endpoint.httpMethod,
      path: endpoint.endpointPath,
    };
    setNodes([...nodes, newNode]);
    addFlowNode({
      id: newId,
      flowId,
      endpointId: endpoint.id,
      x: newNode.x,
      y: newNode.y,
      nodeType: 'http',
    });
    message.success('Node added');
  };

  // Connect nodes
  const handleConnect = (sourceId: number, targetId: number) => {
    const newEdgeId = Date.now();
    const newEdge = { id: newEdgeId, source: sourceId, target: targetId };
    setEdges([...edges, newEdge]);
    addFlowEdge({
      id: newEdgeId,
      flowId,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      edgeType: 'default',
    });
  };

  // Delete a node
  const handleDeleteNode = (nodeId: number) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    removeFlowNode(nodeId);
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const endpointId = e.dataTransfer.getData('endpointId');
    const endpoint = endpoints?.find((ep) => ep.id === parseInt(endpointId));
    if (endpoint) {
      handleAddNode(endpoint);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)' }}>
      {/* Top toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>Back</Button>
          <h2 style={{ margin: 0 }}>{flowDetail?.flow?.name}</h2>
          <Tag color={STATUS_COLORS[flowDetail?.flow?.status || 'draft']}>{flowDetail?.flow?.status}</Tag>
        </Space>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => runMutation.mutate()} loading={runMutation.isPending}>
            Run
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 60px)' }}>
        {/* Endpoint list */}
        <Card title="Endpoint List" style={{ width: 300, overflow: 'auto' }} bodyStyle={{ padding: 0 }}>
          <div style={{ padding: 8 }}>
            {endpoints?.map((ep) => (
              <div
                key={ep.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('endpointId', String(ep.id))}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  cursor: 'grab',
                  fontSize: 12,
                }}
              >
                <Tag color={ep.httpMethod === 'GET' ? 'green' : ep.httpMethod === 'POST' ? 'blue' : 'orange'}>
                  {ep.httpMethod}
                </Tag>
                <span style={{ marginLeft: 8 }}>{ep.summary || ep.endpointPath}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Flow canvas */}
        <Card
          title="Flow Canvas"
          style={{ flex: 1 }}
          bodyStyle={{
            position: 'relative',
            height: 'calc(100% - 57px)',
            overflow: 'auto',
            background: '#fafafa',
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div style={{ position: 'relative', minWidth: 800, minHeight: 400 }}>
            {/* Render edges */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {edges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;
                const sx = sourceNode.x + 75;
                const sy = sourceNode.y + 25;
                const tx = targetNode.x;
                const ty = targetNode.y + 25;
                return (
                  <g key={edge.id}>
                    <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="#1890ff" strokeWidth={2} />
                    <polygon
                      points={`${tx},${ty} ${tx - 10},${ty - 5} ${tx - 10},${ty + 5}`}
                      fill="#1890ff"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Render nodes */}
            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: 150,
                  padding: '12px 16px',
                  background: selectedNode === node.id ? '#e6f7ff' : '#fff',
                  border: `2px solid ${selectedNode === node.id ? '#1890ff' : '#d9d9d9'}`,
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  cursor: 'move',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {node.method && <Tag color={node.method === 'GET' ? 'green' : 'blue'}>{node.method}</Tag>}
                </div>
                <div style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.label}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{node.path}</div>
                <Button
                  size="small"
                  danger
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                >
                  x
                </Button>
              </div>
            ))}

            {nodes.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 100, color: '#999' }}>
                Drag an endpoint from the left panel to add a node
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
