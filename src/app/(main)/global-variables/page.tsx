'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm, Card, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { BrickGlobalVariable } from '@/types';

const TYPE_OPTIONS = [
  { label: 'BUILTIN', value: 'BUILTIN' },
  { label: 'FUNCTION', value: 'FUNCTION' },
  { label: 'DATABASE_QUERY', value: 'DATABASE_QUERY' },
  { label: 'STATIC', value: 'STATIC' },
  { label: 'FILE', value: 'FILE' },
  { label: 'TOKEN', value: 'TOKEN' },
  { label: 'DYNAMIC', value: 'DYNAMIC' },
];

const TYPE_COLORS: Record<string, string> = {
  BUILTIN: 'green',
  FUNCTION: 'blue',
  DATABASE_QUERY: 'purple',
  STATIC: 'default',
  FILE: 'orange',
  TOKEN: 'red',
  DYNAMIC: 'cyan',
};

export default function GlobalVariablesPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BrickGlobalVariable | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['global-variables', typeFilter],
    queryFn: () => api.getGlobalVariables({ type: typeFilter }),
  });

  const createMutation = useMutation({
    mutationFn: ({ variable }: { variable: BrickGlobalVariable }) =>
      api.createGlobalVariable(variable, 'admin'),
    onSuccess: () => {
      message.success('Created successfully');
      queryClient.invalidateQueries({ queryKey: ['global-variables'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ variable }: { variable: BrickGlobalVariable }) =>
      api.updateGlobalVariable(variable, 'admin'),
    onSuccess: () => {
      message.success('Updated successfully');
      queryClient.invalidateQueries({ queryKey: ['global-variables'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteGlobalVariable,
    onSuccess: () => {
      message.success('Deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['global-variables'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<BrickGlobalVariable> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Variable Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color={TYPE_COLORS[t]}>{t}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Syntax', dataIndex: 'syntax', key: 'syntax', ellipsis: true },
    { title: 'Data Type', dataIndex: 'dataType', key: 'dataType' },
    { title: 'Enabled', dataIndex: 'isEnabled', key: 'isEnabled', render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Actions', key: 'action', width: 150, render: (_, record) => (
      <Space>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
        <Popconfirm title="Delete this variable?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const handleEdit = (record: BrickGlobalVariable) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Global Variables</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          New Variable
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={typeFilter || 'all'}
          onChange={(k) => setTypeFilter(k === 'all' ? undefined : k)}
          items={[
            { key: 'all', label: 'All' },
            ...TYPE_OPTIONS.map((t) => ({ key: t.value, label: t.label })),
          ]}
        />
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editingRecord ? 'Edit Variable' : 'New Variable'}
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            if (editingRecord) {
              updateMutation.mutate({ variable: { ...editingRecord, ...values } });
            } else {
              createMutation.mutate({ variable: values });
            }
          });
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Variable Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="syntax" label="Syntax Template">
            <Input placeholder='e.g. ${{variableName}}' />
          </Form.Item>
          <Form.Item name="dataType" label="Data Type">
            <Select options={[
              { label: 'string', value: 'string' },
              { label: 'number', value: 'number' },
              { label: 'boolean', value: 'boolean' },
              { label: 'object', value: 'object' },
              { label: 'array', value: 'array' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
