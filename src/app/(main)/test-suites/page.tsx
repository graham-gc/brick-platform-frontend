'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { BrickTestSuite } from '@/types';

export default function TestSuitesPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BrickTestSuite | null>(null);
  const [swaggerMappingId, setSwaggerMappingId] = useState<number | undefined>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ['test-suites', swaggerMappingId, pageNum, pageSize],
    queryFn: () => api.getTestSuites(swaggerMappingId!, { pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const { data: flows } = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.getFlows(),
  });

  const createMutation = useMutation({
    mutationFn: ({ suite, flowMappings }: { suite: BrickTestSuite; flowMappings: unknown[] }) =>
      api.createTestSuite(suite, flowMappings),
    onSuccess: () => {
      message.success('Created successfully');
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTestSuite(id),
    onSuccess: () => {
      message.success('Deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => api.runTestSuite(id, 'admin'),
    onSuccess: () => {
      message.success('Test suite started');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<BrickTestSuite> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Test Suite Name', dataIndex: 'name', key: 'name' },
    { title: 'Environment', dataIndex: 'env', key: 'env', render: (env) => <Tag color="blue">{env}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Created At', dataIndex: 'createTime', key: 'createTime' },
    { title: 'Actions', key: 'action', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => runMutation.mutate(record.id!)}>Run</Button>
        <Popconfirm title="Delete this test suite?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Test Suites</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          New Test Suite
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
        title="New Test Suite"
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            createMutation.mutate({
              suite: { ...values, swaggerMappingId },
              flowMappings: [],
            });
          });
        }}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Test Suite Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
