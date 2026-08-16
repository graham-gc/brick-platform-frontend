'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, EditOutlined, CopyOutlined, PartitionOutlined } from '@ant-design/icons';
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

  const updateMutation = useMutation({
    mutationFn: async (flow: BrickFlow) => {
      const detail = await api.getFlowDetail(flow.id!);
      return api.updateFlow({
        flow,
        nodes: detail.nodes,
        edges: detail.edges,
        operator: 'admin',
      });
    },
    onSuccess: () => {
      message.success('Updated successfully');
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
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      if (run.status === 'success') {
        message.success(`Flow completed in ${run.durationMs ?? 0} ms`);
      } else {
        message.error(run.errorMsg ? `Flow failed: ${run.errorMsg}` : 'Flow failed');
      }
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
    { title: 'ID', dataIndex: 'id', key: 'id', responsive: ['md'] },
    { title: 'Flow Name', dataIndex: 'name', key: 'name', render: (name, record) => (
      <Link className="responsive-table-text" href={`/flows/${record.id}`}>{name}</Link>
    )},
    { title: 'Environment', dataIndex: 'env', key: 'env', responsive: ['sm'], render: (env) => <Tag color="blue">{env}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', responsive: ['sm'], render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Version', dataIndex: 'version', key: 'version', responsive: ['lg'] },
    { title: 'Created At', dataIndex: 'createTime', key: 'createTime', responsive: ['xl'] },
    { title: 'Actions', key: 'action', render: (_, record) => (
      <div className="responsive-table-actions">
        <Link href={`/flows/${record.id}`}>
          <Button size="small" type="link" icon={<PartitionOutlined />} title="Design" aria-label="Design"><span className="responsive-action-label">Design</span></Button>
        </Link>
        <Button size="small" type="link" icon={<PlayCircleOutlined />} title="Run" aria-label="Run" onClick={() => runMutation.mutate(record.id!)}><span className="responsive-action-label">Run</span></Button>
        <Button size="small" type="link" icon={<EditOutlined />} title="Edit" aria-label="Edit" onClick={() => handleEdit(record)}><span className="responsive-action-label">Edit</span></Button>
        <Button size="small" type="link" icon={<CopyOutlined />} title="Copy" aria-label="Copy" onClick={() => handleCopy(record)}><span className="responsive-action-label">Copy</span></Button>
        <Popconfirm title="Delete this flow?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />} title="Delete" aria-label="Delete"><span className="responsive-action-label">Delete</span></Button>
        </Popconfirm>
      </div>
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
        <Link href="/flows/new">
          <Button type="primary" icon={<PlusOutlined />}>New Flow</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap className="responsive-filter-bar">
          <Select
            placeholder="Select an application"
            className="responsive-filter-control"
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
        className="responsive-data-table"
        columns={columns}
        dataSource={data?.rows}
        rowKey="id"
        loading={isLoading}
        tableLayout="auto"
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
        title="Edit Flow"
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            if (editingRecord) updateMutation.mutate({ ...editingRecord, ...values });
          });
        }}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Flow Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="swaggerMappingId" label="Application" rules={[{ required: true }]}>
            <Select disabled>
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
