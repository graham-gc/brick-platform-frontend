'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm, Card, Row, Col } from 'antd';
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
  const { message } = AntdApp.useApp();
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
      message.success('Created successfully');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteFlow(id, 'admin'),
    onSuccess: () => {
      message.success('Deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => api.runFlow(id, 'admin'),
    onSuccess: () => {
      message.success('Flow started');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const copyMutation = useMutation({
    mutationFn: ({ flowId, newName }: { flowId: number; newName: string }) =>
      api.copyFlow(flowId, newName),
    onSuccess: () => {
      message.success('Copied successfully');
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<BrickFlow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Flow Name', dataIndex: 'name', key: 'name', render: (name, record) => (
      <Link href={`/flows/${record.id}`}>{name}</Link>
    )},
    { title: 'Environment', dataIndex: 'env', key: 'env', render: (env) => <Tag color="blue">{env}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    { title: 'Created At', dataIndex: 'createTime', key: 'createTime' },
    { title: 'Actions', key: 'action', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => runMutation.mutate(record.id!)}>Run</Button>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
        <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => handleCopy(record)}>Copy</Button>
        <Popconfirm title="Delete this flow?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />}>Delete</Button>
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
        <h2>Test Flows</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          New Flow
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Select an application"
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
        title={editingRecord ? 'Edit Flow' : 'New Flow'}
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
          <Form.Item name="name" label="Flow Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="swaggerMappingId" label="Application" rules={[{ required: true }]}>
            <Select>
              {mappings?.map((m) => (
                <Select.Option key={m.id} value={m.id!}>
                  {m.appName} - {m.env} - {m.versionTag}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
