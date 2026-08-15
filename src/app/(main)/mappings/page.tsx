'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm, Upload, Radio } from 'antd';
import { PlusOutlined, SyncOutlined, DeleteOutlined, EditOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { AppSwaggerMapping, ValidateParseRequest } from '@/types';

const ENV_OPTIONS = [
  { label: 'Development', value: 'dev' },
  { label: 'Test', value: 'test' },
  { label: 'UAT', value: 'uat' },
  { label: 'Production', value: 'pro' },
];

const VERSION_OPTIONS = [
  { label: 'main', value: 'main' },
  { label: 'dev', value: 'dev' },
  { label: 'test', value: 'test' },
];

const MAX_SWAGGER_FILE_SIZE = 5 * 1024 * 1024;
type SwaggerSourceMode = 'url' | 'file';

export default function MappingsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AppSwaggerMapping | null>(null);
  const [createSourceMode, setCreateSourceMode] = useState<SwaggerSourceMode>('url');
  const [createSwaggerContent, setCreateSwaggerContent] = useState('');
  const [createSwaggerFileName, setCreateSwaggerFileName] = useState('');
  const [createSwaggerType, setCreateSwaggerType] = useState('');
  const createValidationRequestId = useRef(0);
  const [syncVisible, setSyncVisible] = useState(false);
  const [syncForm] = Form.useForm();
  const [swaggerContent, setSwaggerContent] = useState('');
  const [swaggerFileName, setSwaggerFileName] = useState('');
  const [swaggerType, setSwaggerType] = useState('');
  const [sourceMode, setSourceMode] = useState<SwaggerSourceMode>('url');
  const validationRequestId = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const createMutation = useMutation({
    mutationFn: async ({
      mapping,
      swaggerContent: validatedContent,
    }: {
      mapping: AppSwaggerMapping;
      swaggerContent: string;
    }) => {
      const mappingId = await api.createMapping(mapping);
      try {
        return await api.syncEndpoints({
          swaggerMappingId: mappingId,
          env: mapping.env!,
          appConfigId: mapping.appConfigId,
          versionTag: mapping.versionTag!,
          swaggerUrl: mapping.swaggerUrl,
          swaggerContent: validatedContent,
          operator: 'admin',
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Mapping ${mappingId} was created, but endpoint import failed: ${reason}`
        );
      }
    },
    onSuccess: (result) => {
      message.success(`Mapping created. Imported ${result.endpointCount} endpoints.`);
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      queryClient.invalidateQueries({ queryKey: ['endpoints', result.mappingId] });
      closeMappingModal();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const createValidateMutation = useMutation({
    mutationFn: ({ request }: { request: ValidateParseRequest; requestId: number }) =>
      api.validateAndParse(request),
    onMutate: () => {
      setCreateSwaggerContent('');
      setCreateSwaggerType('');
    },
    onSuccess: (data, variables) => {
      if (variables.requestId !== createValidationRequestId.current) return;
      if (data.valid && data.swaggerContent) {
        setCreateSwaggerContent(data.swaggerContent);
        setCreateSwaggerType(data.type);
        message.success('Swagger document validated successfully');
      } else {
        setCreateSwaggerContent('');
        setCreateSwaggerType('');
        message.error(data.type || 'Invalid Swagger/OpenAPI document');
      }
    },
    onError: (err: Error, variables) => {
      if (variables.requestId !== createValidationRequestId.current) return;
      setCreateSwaggerContent('');
      setCreateSwaggerType('');
      message.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateMapping,
    onSuccess: () => {
      message.success('Updated successfully');
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      setEditVisible(false);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMapping(id, 'admin'),
    onSuccess: () => {
      message.success('Deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const validateMutation = useMutation({
    mutationFn: ({ request }: { request: ValidateParseRequest; requestId: number }) =>
      api.validateAndParse(request),
    onMutate: () => {
      setSwaggerContent('');
      setSwaggerType('');
    },
    onSuccess: (data, variables) => {
      if (variables.requestId !== validationRequestId.current) return;
      if (data.valid && data.swaggerContent) {
        setSwaggerContent(data.swaggerContent);
        setSwaggerType(data.type);
        message.success('Swagger document validated successfully');
      } else {
        setSwaggerContent('');
        setSwaggerType('');
        message.error(data.type || 'Invalid Swagger/OpenAPI document');
      }
    },
    onError: (err: Error, variables) => {
      if (variables.requestId !== validationRequestId.current) return;
      setSwaggerContent('');
      setSwaggerType('');
      message.error(err.message);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (request: Parameters<typeof api.syncEndpoints>[0]) => {
      if (editingRecord && request.swaggerUrl && request.swaggerUrl !== editingRecord.swaggerUrl) {
        await api.updateMapping({
          ...editingRecord,
          swaggerUrl: request.swaggerUrl,
          updateBy: 'admin',
        });
      }
      return api.syncEndpoints(request);
    },
    onSuccess: (result) => {
      message.success(`Sync completed. Imported ${result.endpointCount} endpoints.`);
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      queryClient.invalidateQueries({ queryKey: ['endpoints', result.mappingId] });
      closeSyncModal();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns: ColumnsType<AppSwaggerMapping> = [
    { title: 'ID', dataIndex: 'id', key: 'id', responsive: ['md'] },
    { title: 'Application Name', dataIndex: 'appName', key: 'appName' },
    { title: 'Environment', dataIndex: 'env', key: 'env', responsive: ['sm'], render: (env) => <Tag color="blue">{env}</Tag> },
    { title: 'Version', dataIndex: 'versionTag', key: 'versionTag', responsive: ['md'] },
    { title: 'Swagger URL', dataIndex: 'swaggerUrl', key: 'swaggerUrl', ellipsis: true, responsive: ['lg'] },
    { title: 'Owner', dataIndex: 'owner', key: 'owner', responsive: ['xl'] },
    { title: 'Actions', key: 'action', render: (_, record) => (
      <div className="mapping-actions">
        <Button size="small" icon={<SyncOutlined />} title="Sync" aria-label="Sync" onClick={() => handleSync(record)}>
          <span className="mapping-action-label">Sync</span>
        </Button>
        <Button size="small" icon={<EditOutlined />} title="Edit" aria-label="Edit" onClick={() => handleEdit(record)}>
          <span className="mapping-action-label">Edit</span>
        </Button>
        <Popconfirm title="Delete this mapping?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger icon={<DeleteOutlined />} title="Delete" aria-label="Delete">
            <span className="mapping-action-label">Delete</span>
          </Button>
        </Popconfirm>
      </div>
    )},
  ];

  const clearCreateValidatedSwagger = () => {
    createValidationRequestId.current += 1;
    setCreateSwaggerContent('');
    setCreateSwaggerType('');
  };

  const validateCreateSwagger = (request: ValidateParseRequest) => {
    const requestId = createValidationRequestId.current + 1;
    createValidationRequestId.current = requestId;
    createValidateMutation.mutate({ request, requestId });
  };

  const resetCreateImport = () => {
    createValidationRequestId.current += 1;
    setCreateSourceMode('url');
    setCreateSwaggerContent('');
    setCreateSwaggerFileName('');
    setCreateSwaggerType('');
  };

  const openNewMappingModal = () => {
    setEditingRecord(null);
    form.resetFields();
    resetCreateImport();
    setEditVisible(true);
  };

  const closeMappingModal = () => {
    setEditVisible(false);
    form.resetFields();
    resetCreateImport();
  };

  const handleCreateValidateUrl = (rawUrl: string) => {
    const swaggerUrl = rawUrl.trim();
    clearCreateValidatedSwagger();
    if (!swaggerUrl) {
      message.error('Enter a Swagger URL');
      return;
    }
    validateCreateSwagger({ swaggerUrl });
  };

  const handleCreateSwaggerFile = async (file: File) => {
    clearCreateValidatedSwagger();
    const fileSelectionId = createValidationRequestId.current;
    setCreateSwaggerFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setCreateSwaggerFileName('');
      message.error('Only Swagger/OpenAPI JSON files are currently supported');
      return false;
    }
    if (file.size > MAX_SWAGGER_FILE_SIZE) {
      setCreateSwaggerFileName('');
      message.error('The Swagger file must not exceed 5 MB');
      return false;
    }

    try {
      const content = await file.text();
      if (fileSelectionId !== createValidationRequestId.current) return false;
      validateCreateSwagger({ swaggerFileContent: content });
    } catch {
      setCreateSwaggerFileName('');
      message.error('Unable to read the Swagger file');
    }
    return false;
  };

  const handleMappingSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        updateMutation.mutate({ ...editingRecord, ...values });
        return;
      }

      if (!createSwaggerContent) {
        message.error('Validate the Swagger document before creating the mapping');
        return;
      }

      createMutation.mutate({
        mapping: {
          ...values,
          swaggerUrl: createSourceMode === 'url' ? values.swaggerUrl.trim() : undefined,
          active: 1,
          createBy: 'admin',
        },
        swaggerContent: createSwaggerContent,
      });
    } catch {
      return;
    }
  };

  const handleEdit = (record: AppSwaggerMapping) => {
    resetCreateImport();
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  const handleSync = (record: AppSwaggerMapping) => {
    validationRequestId.current += 1;
    setEditingRecord(record);
    syncForm.resetFields();
    setSwaggerContent('');
    setSwaggerFileName('');
    setSwaggerType('');
    setSourceMode(record.swaggerUrl ? 'url' : 'file');
    syncForm.setFieldsValue({
      swaggerUrl: record.swaggerUrl,
      env: record.env,
      versionTag: record.versionTag,
    });
    setSyncVisible(true);
  };

  const clearValidatedSwagger = () => {
    validationRequestId.current += 1;
    setSwaggerContent('');
    setSwaggerType('');
  };

  const validateSwagger = (request: ValidateParseRequest) => {
    const requestId = validationRequestId.current + 1;
    validationRequestId.current = requestId;
    validateMutation.mutate({ request, requestId });
  };

  const closeSyncModal = () => {
    validationRequestId.current += 1;
    setSyncVisible(false);
    syncForm.resetFields();
    setSwaggerContent('');
    setSwaggerFileName('');
    setSwaggerType('');
    setSourceMode('url');
  };

  const handleValidate = (rawUrl: string) => {
    const swaggerUrl = rawUrl.trim();
    clearValidatedSwagger();
    if (!swaggerUrl) {
      message.error('Enter a Swagger URL');
      return;
    }
    validateSwagger({ swaggerUrl });
  };

  const handleSwaggerFile = async (file: File) => {
    clearValidatedSwagger();
    const fileSelectionId = validationRequestId.current;
    setSwaggerFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setSwaggerFileName('');
      message.error('Only Swagger/OpenAPI JSON files are currently supported');
      return false;
    }
    if (file.size > MAX_SWAGGER_FILE_SIZE) {
      setSwaggerFileName('');
      message.error('The Swagger file must not exceed 5 MB');
      return false;
    }

    try {
      const content = await file.text();
      if (fileSelectionId !== validationRequestId.current) return false;
      validateSwagger({ swaggerFileContent: content });
    } catch {
      setSwaggerFileName('');
      message.error('Unable to read the Swagger file');
    }
    return false;
  };

  const handleSyncSubmit = async () => {
    if (!swaggerContent) {
      message.error('Validate the Swagger document before syncing');
      return;
    }

    try {
      const values = await syncForm.validateFields();
      syncMutation.mutate({
        swaggerMappingId: editingRecord?.id,
        env: values.env,
        appConfigId: editingRecord?.appConfigId,
        versionTag: values.versionTag,
        swaggerUrl: sourceMode === 'url'
          ? values.swaggerUrl.trim()
          : editingRecord?.swaggerUrl,
        swaggerContent,
        operator: 'admin',
      });
    } catch {
      return;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Swagger Mappings</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNewMappingModal}>
          New Mapping
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        tableLayout="auto"
      />

      {/* Create/edit mapping modal */}
      <Modal
        title={editingRecord ? 'Edit Mapping' : 'New Mapping'}
        open={editVisible}
        onCancel={closeMappingModal}
        onOk={() => void handleMappingSubmit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okButtonProps={{
          disabled: !editingRecord
            && (!createSwaggerContent || createValidateMutation.isPending),
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="appName" label="Application Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appConfigId" label="AppConfigId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="env" label="Environment" rules={[{ required: true }]}>
            <Select options={ENV_OPTIONS} />
          </Form.Item>
          <Form.Item name="versionTag" label="Version" rules={[{ required: true }]}>
            <Select options={VERSION_OPTIONS} />
          </Form.Item>
          {editingRecord ? (
            <Form.Item name="swaggerUrl" label="Swagger URL">
              <Input />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="Import Method" required>
                <Radio.Group
                  value={createSourceMode}
                  onChange={(event) => {
                    setCreateSourceMode(event.target.value);
                    clearCreateValidatedSwagger();
                    setCreateSwaggerFileName('');
                  }}
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { label: 'Swagger URL', value: 'url' },
                    { label: 'Swagger JSON', value: 'file' },
                  ]}
                />
              </Form.Item>

              {createSourceMode === 'url' ? (
                <Form.Item
                  name="swaggerUrl"
                  label="Swagger URL"
                  rules={[
                    { required: true, message: 'Enter a Swagger URL' },
                    { type: 'url', message: 'Enter a valid HTTP or HTTPS URL' },
                  ]}
                >
                  <Input.Search
                    enterButton="Test URL"
                    onChange={clearCreateValidatedSwagger}
                    onSearch={handleCreateValidateUrl}
                    loading={createValidateMutation.isPending}
                  />
                </Form.Item>
              ) : (
                <Form.Item label="Swagger JSON File" required>
                  <Upload.Dragger
                    accept=".json,application/json"
                    beforeUpload={handleCreateSwaggerFile}
                    showUploadList={false}
                    multiple={false}
                    disabled={createValidateMutation.isPending}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">
                      Click or drag a Swagger JSON file to this area
                    </p>
                    <p className="ant-upload-hint">
                      JSON files only, up to 5 MB. Validation starts automatically.
                    </p>
                  </Upload.Dragger>
                  {createSwaggerFileName && (
                    <div style={{ marginTop: 8 }}>{createSwaggerFileName}</div>
                  )}
                </Form.Item>
              )}

              {createSwaggerContent && (
                <Tag color="success">Validation passed: {createSwaggerType}</Tag>
              )}
            </>
          )}
          <Form.Item name="owner" label="Owner">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Endpoint sync modal */}
      <Modal
        title="Sync Endpoint Definitions"
        open={syncVisible}
        onCancel={closeSyncModal}
        onOk={() => void handleSyncSubmit()}
        confirmLoading={syncMutation.isPending}
        okButtonProps={{ disabled: !swaggerContent || validateMutation.isPending }}
      >
        <Form form={syncForm} layout="vertical">
          <Form.Item label="Import Method">
            <Radio.Group
              value={sourceMode}
              onChange={(event) => {
                setSourceMode(event.target.value);
                clearValidatedSwagger();
                setSwaggerFileName('');
              }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Swagger URL', value: 'url' },
                { label: 'Local JSON File', value: 'file' },
              ]}
            />
          </Form.Item>

          {sourceMode === 'url' ? (
            <Form.Item
              name="swaggerUrl"
              label="Swagger URL"
              rules={[
                { required: true, message: 'Enter a Swagger URL' },
                { type: 'url', message: 'Enter a valid HTTP or HTTPS URL' },
              ]}
            >
              <Input.Search
                enterButton="Validate"
                onChange={clearValidatedSwagger}
                onSearch={handleValidate}
                loading={validateMutation.isPending}
              />
            </Form.Item>
          ) : (
            <Form.Item label="Swagger JSON File" required>
              <Space>
                <Upload
                  accept=".json,application/json"
                  beforeUpload={handleSwaggerFile}
                  showUploadList={false}
                  disabled={validateMutation.isPending}
                >
                  <Button icon={<UploadOutlined />} loading={validateMutation.isPending}>
                    Choose File
                  </Button>
                </Upload>
                {swaggerFileName && <span>{swaggerFileName}</span>}
              </Space>
            </Form.Item>
          )}

          <Form.Item name="env" label="Environment" rules={[{ required: true }]}>
            <Select options={ENV_OPTIONS} disabled />
          </Form.Item>
          <Form.Item name="versionTag" label="Version" rules={[{ required: true }]}>
            <Select options={VERSION_OPTIONS} disabled />
          </Form.Item>
        </Form>
        {swaggerContent && (
          <Tag color="success">Validation passed: {swaggerType}</Tag>
        )}
      </Modal>
    </div>
  );
}
