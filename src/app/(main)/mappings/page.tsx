'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, SyncOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { AppSwaggerMapping } from '@/types';

const ENV_OPTIONS = [
  { label: '开发环境', value: 'dev' },
  { label: '测试环境', value: 'test' },
  { label: 'UAT环境', value: 'uat' },
  { label: '生产环境', value: 'pro' },
];

const VERSION_OPTIONS = [
  { label: 'main', value: 'main' },
  { label: 'dev', value: 'dev' },
  { label: 'test', value: 'test' },
];

export default function MappingsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AppSwaggerMapping | null>(null);
  const [syncVisible, setSyncVisible] = useState(false);
  const [syncForm] = Form.useForm();
  const [swaggerContent, setSwaggerContent] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const createMutation = useMutation({
    mutationFn: api.createMapping,
    onSuccess: () => {
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: api.updateMapping,
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMapping(id, 'admin'),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const validateMutation = useMutation({
    mutationFn: api.validateAndParse,
    onSuccess: (data) => {
      if (data.valid) {
        setSwaggerContent((data.swaggerContent as string) || '');
        message.success('Swagger文档校验成功');
      } else {
        message.error('无效的Swagger文档');
      }
    },
    onError: (err: Error) => message.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: api.syncEndpoints,
    onSuccess: () => {
      message.success('同步成功');
      setSyncVisible(false);
      syncForm.resetFields();
      setSwaggerContent('');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<AppSwaggerMapping> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '应用名称', dataIndex: 'appName', key: 'appName' },
    { title: '环境', dataIndex: 'env', key: 'env', render: (env) => <Tag color="blue">{env}</Tag> },
    { title: '版本', dataIndex: 'versionTag', key: 'versionTag' },
    { title: 'Swagger URL', dataIndex: 'swaggerUrl', key: 'swaggerUrl', ellipsis: true },
    { title: '负责人', dataIndex: 'owner', key: 'owner' },
    { title: '操作', key: 'action', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" icon={<SyncOutlined />} onClick={() => handleSync(record)}>同步</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const handleEdit = (record: AppSwaggerMapping) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  const handleSync = (record: AppSwaggerMapping) => {
    setEditingRecord(record);
    syncForm.setFieldsValue({ env: record.env, versionTag: record.versionTag });
    setSyncVisible(true);
  };

  const handleValidate = () => {
    const url = syncForm.getFieldValue('swaggerUrl');
    if (url) {
      validateMutation.mutate({ swaggerUrl: url });
    }
  };

  const handleSyncSubmit = () => {
    if (!swaggerContent) {
      message.error('请先校验Swagger文档');
      return;
    }
    const values = syncForm.getFieldsValue();
    syncMutation.mutate({
      env: values.env,
      versionTag: values.versionTag,
      swaggerContent,
      operator: 'admin',
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Swagger 映射管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setEditVisible(true); }}>
          新建映射
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑映射' : '新建映射'}
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            if (editingRecord) {
              updateMutation.mutate({ ...editingRecord, ...values });
            } else {
              createMutation.mutate(values);
            }
          });
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="appName" label="应用名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appConfigId" label="AppConfigId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="env" label="环境" rules={[{ required: true }]}>
            <Select options={ENV_OPTIONS} />
          </Form.Item>
          <Form.Item name="versionTag" label="版本" rules={[{ required: true }]}>
            <Select options={VERSION_OPTIONS} />
          </Form.Item>
          <Form.Item name="swaggerUrl" label="Swagger URL">
            <Input />
          </Form.Item>
          <Form.Item name="owner" label="负责人">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 同步弹窗 */}
      <Modal
        title="同步接口定义"
        open={syncVisible}
        onCancel={() => { setSyncVisible(false); syncForm.resetFields(); setSwaggerContent(''); }}
        onOk={handleSyncSubmit}
        confirmLoading={syncMutation.isPending}
      >
        <Form form={syncForm} layout="vertical">
          <Form.Item name="swaggerUrl" label="Swagger URL">
            <Input.Search
              enterButton="校验"
              onSearch={handleValidate}
              loading={validateMutation.isPending}
            />
          </Form.Item>
          <Form.Item name="env" label="环境" rules={[{ required: true }]}>
            <Select options={ENV_OPTIONS} />
          </Form.Item>
          <Form.Item name="versionTag" label="版本" rules={[{ required: true }]}>
            <Select options={VERSION_OPTIONS} />
          </Form.Item>
        </Form>
        {swaggerContent && <Tag color="success">文档校验通过</Tag>}
      </Modal>
    </div>
  );
}