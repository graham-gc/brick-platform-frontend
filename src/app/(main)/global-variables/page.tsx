'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Tabs } from 'antd';
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
      message.success('创建成功');
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
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['global-variables'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteGlobalVariable,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['global-variables'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<BrickGlobalVariable> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '变量名', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t) => <Tag color={TYPE_COLORS[t]}>{t}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '语法', dataIndex: 'syntax', key: 'syntax', ellipsis: true },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType' },
    { title: '启用', dataIndex: 'isEnabled', key: 'isEnabled', render: (v) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
    { title: '操作', key: 'action', width: 150, render: (_, record) => (
      <Space>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />}>删除</Button>
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
        <h2>全域变量</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          新建变量
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={typeFilter || 'all'}
          onChange={(k) => setTypeFilter(k === 'all' ? undefined : k)}
          items={[
            { key: 'all', label: '全部' },
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
        title={editingRecord ? '编辑变量' : '新建变量'}
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
          <Form.Item name="name" label="变量名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="syntax" label="语法模板">
            <Input placeholder='如: ${{variableName}}' />
          </Form.Item>
          <Form.Item name="dataType" label="数据类型">
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