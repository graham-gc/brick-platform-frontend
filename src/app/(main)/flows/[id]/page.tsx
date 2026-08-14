'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Space, message, Spin, Tag, Modal, Form, Input, Select } from 'antd';
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

  // 加载流程详情
  const { data: flowDetail, isLoading } = useQuery({
    queryKey: ['flow-detail', flowId],
    queryFn: () => api.getFlowDetail(flowId),
  });

  // 加载接口列表
  const { data: endpoints } = useQuery({
    queryKey: ['endpoints', flowDetail?.flow?.swaggerMappingId],
    queryFn: () => api.getAllEndpoints(flowDetail!.flow!.swaggerMappingId!),
    enabled: !!flowDetail?.flow?.swaggerMappingId,
  });

  // 同步 store 数据到本地状态
  useEffect(() => {
    if (flowDetail?.nodes) {
      setFlowNodes(flowDetail.nodes);
      setFlowEdges(flowDetail.edges);
      // 转换为可视化节点
      const visualNodes = flowDetail.nodes.map((n, i) => ({
        id: n.id!,
        x: n.x || 100 + i * 200,
        y: n.y || 200,
        label: n.endpointId ? `接口${n.endpointId}` : '节点',
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

  // 保存流程
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
      message.success('保存成功');
      queryClient.invalidateQueries({ queryKey: ['flow-detail', flowId] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 运行流程
  const runMutation = useMutation({
    mutationFn: () => api.runFlow(flowId, 'admin'),
    onSuccess: () => {
      message.success('流程已启动');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 添加节点
  const handleAddNode = (endpoint: EndpointDefinition) => {
    const newId = Date.now();
    const newNode = {
      id: newId,
      x: 100 + nodes.length * 200,
      y: 200,
      label: endpoint.summary || endpoint.endpointPath || '未知节点',
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
    message.success('节点已添加');
  };

  // 连接节点
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

  // 删除节点
  const handleDeleteNode = (nodeId: number) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    removeFlowNode(nodeId);
  };

  // 拖拽处理
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
      {/* 顶部工具栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>返回</Button>
          <h2 style={{ margin: 0 }}>{flowDetail?.flow?.name}</h2>
          <Tag color={STATUS_COLORS[flowDetail?.flow?.status || 'draft']}>{flowDetail?.flow?.status}</Tag>
        </Space>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => runMutation.mutate()} loading={runMutation.isPending}>
            运行
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            保存
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 60px)' }}>
        {/* 左侧接口列表 */}
        <Card title="接口列表" style={{ width: 300, overflow: 'auto' }} bodyStyle={{ padding: 0 }}>
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

        {/* 中间画布 */}
        <Card
          title="流程画布"
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
            {/* 渲染连线 */}
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

            {/* 渲染节点 */}
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
                从左侧拖拽接口到此处添加节点
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}