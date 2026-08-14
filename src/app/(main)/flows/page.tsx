'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Row, Col } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import * as api from '@/services/api';
import type { BrickFlow } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  active: 'green',
  disabled: 'red',
};

export default function FlowsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BrickFlow | null>(null);
  const [swaggerMappingId, setSwaggerMappingId] = useState<number | undefined>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ['flows', swaggerMappingId, pageNum, pageSize],
    queryFn: () => api.getFlows({ env: 'dev' }, { swaggerMappingId, pageNum, pageSize }),
  });

  const { data: mappings } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const createMutation = useMutation({
    mutationFn: api.createFlow,
    onSuccess: () => {
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteFlow(id, 'admin'),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => api.runFlow(id, 'admin'),
    onSuccess: () => {
      message.success('流程已启动');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const copyMutation = useMutation({
    mutationFn: ({ flowId, newName }: { flowId: number; newName: string }) =>
      api.copyFlow(flowId, newName),
    onSuccess: () => {
      message.success('复制成功');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<BrickFlow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (name, record) => (
      <Link href={`/flows/${record.id}`}>{name}</Link>
    )},
    { title: '环境', dataIndex: 'env', key: 'env', render: (env) => <Tag color="blue">{env}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => runMutation.mutate(record.id!)}>运行</Button>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => handleCopy(record)}>复制</Button>
        <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const handleEdit = (record: BrickFlow) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  const handleCopy = (record: BrickFlow) => {
    copyMutation.mutate({ flowId: record.id!, newName: `${record.name}-copy` });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>流程管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          新建流程
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择应用"
            style={{ width: 300 }}
            allowClear
            onChange={(v) => setSwaggerMappingId(v)}
          >
            {mappings?.map((m) => (
              <Select.Option key={m.id} value={m.id!}>
                {m.appName} - {m.env} - {m.versionTag}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.rows}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
      />

      <Modal
        title={editingRecord ? '编辑流程' : '新建流程'}
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            const flow = editingRecord ? { ...editingRecord, ...values } : { ...values, env: 'dev', version: 1 };
            createMutation.mutate({ flow, nodes: [], edges: [], operator: 'admin' });
          });
        }}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="流程名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="swaggerMappingId" label="关联应用" rules={[{ required: true }]}>
            <Select>
              {mappings?.map((m) => (
                <Select.Option key={m.id} value={m.id!}>
                  {m.appName} - {m.env} - {m.versionTag}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}