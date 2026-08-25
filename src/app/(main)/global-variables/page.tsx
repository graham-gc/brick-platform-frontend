'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Card, Tabs, Switch, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { BrickGlobalVariable } from '@/types';

const TYPE_OPTIONS = [
  { label: 'BUILTIN (predefined, not implemented)', value: 'BUILTIN', disabled: true },
  { label: 'FUNCTION', value: 'FUNCTION' },
  { label: 'DATABASE_QUERY', value: 'DATABASE_QUERY' },
  { label: 'STATIC', value: 'STATIC' },
  { label: 'FILE', value: 'FILE' },
  { label: 'TOKEN', value: 'TOKEN' },
  { label: 'DYNAMIC', value: 'DYNAMIC' },
];

const DATA_TYPE_OPTIONS = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'object', value: 'object' },
  { label: 'array', value: 'array' },
];

type GlobalVariableForm = BrickGlobalVariable & {
  enabled?: boolean;
  staticValue?: unknown;
  functionScript?: string;
  parameters?: FunctionParameter[];
  databaseSource?: string;
  databaseSql?: string;
  databaseResultMode?: 'VALUE' | 'ROW' | 'LIST';
};

type FunctionParameter = {
  name?: string;
  type?: string;
};

function staticValueFromConfig(config?: string): unknown {
  if (!config) return undefined;
  try {
    const parsed = JSON.parse(config) as { value?: unknown };
    if (parsed && typeof parsed === 'object' && 'value' in parsed) return parsed.value;
  } catch {
    return undefined;
  }
  return undefined;
}

function parseStructuredStaticValue(value: unknown, dataType?: string): unknown {
  if (dataType !== 'object' && dataType !== 'array') return value;
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function displayStaticValue(value: unknown, dataType?: string): unknown {
  if ((dataType === 'object' || dataType === 'array') && value !== undefined) {
    return JSON.stringify(value, null, 2);
  }
  return value;
}

function isStoredValueType(type?: string) {
  return type === 'STATIC' || type === 'TOKEN';
}

function functionScriptFromConfig(config?: string): string | undefined {
  if (!config) return undefined;
  try {
    const parsed = JSON.parse(config) as { script?: unknown };
    return typeof parsed?.script === 'string' ? parsed.script : undefined;
  } catch {
    return undefined;
  }
}

function functionParametersFromSchema(paramSchema?: string): FunctionParameter[] {
  if (!paramSchema) return [];
  try {
    const parsed = JSON.parse(paramSchema);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function objectConfig(config?: string): Record<string, unknown> {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

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
  const selectedType = Form.useWatch('type', form);
  const selectedDataType = Form.useWatch('dataType', form);
  const variableName = Form.useWatch('name', form);
  const functionParameters = Form.useWatch('parameters', form) as FunctionParameter[] | undefined;
  const syntaxPreview = useMemo(
    () => {
      if (!variableName) return '${{varName}}';
      const parameters = selectedType === 'FUNCTION' || selectedType === 'DATABASE_QUERY'
        ? (functionParameters || []).map((parameter) => parameter?.name).filter(Boolean).join(',')
        : '';
      return parameters ? `\${{${variableName}(${parameters})}}` : `\${{${variableName}}}`;
    },
    [functionParameters, selectedType, variableName],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['global-variables', typeFilter],
    queryFn: () => api.getGlobalVariables({ type: typeFilter }),
  });

  const { data: databaseSources = [] } = useQuery({
    queryKey: ['global-variable-data-sources'],
    queryFn: api.getGlobalVariableDataSources,
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
    { title: 'ID', dataIndex: 'id', key: 'id', responsive: ['md'] },
    { title: 'Variable Name', dataIndex: 'name', key: 'name', render: (value) => <span className="responsive-table-text">{value}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type', responsive: ['sm'], render: (t) => <Tag color={TYPE_COLORS[t]}>{t}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', responsive: ['lg'], render: (value) => <span className="responsive-table-text">{value}</span> },
    { title: 'Syntax', dataIndex: 'syntax', key: 'syntax', responsive: ['xl'], render: (value) => <span className="responsive-table-text">{value}</span> },
    { title: 'Data Type', dataIndex: 'dataType', key: 'dataType', responsive: ['md'] },
    { title: 'Enabled', dataIndex: 'isEnabled', key: 'isEnabled', responsive: ['sm'], render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Actions', key: 'action', render: (_, record) => (
      <div className="responsive-table-actions">
        <Button size="small" type="link" icon={<EditOutlined />} title="Edit" aria-label="Edit" onClick={() => handleEdit(record)}><span className="responsive-action-label">Edit</span></Button>
        <Popconfirm title="Delete this variable?" onConfirm={() => deleteMutation.mutate(record.id!)}>
          <Button size="small" danger type="link" icon={<DeleteOutlined />} title="Delete" aria-label="Delete"><span className="responsive-action-label">Delete</span></Button>
        </Popconfirm>
      </div>
    )},
  ];

  const handleEdit = (record: BrickGlobalVariable) => {
    const config = objectConfig(record.config);
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      enabled: record.isEnabled !== 0,
      staticValue: displayStaticValue(staticValueFromConfig(record.config), record.dataType),
      functionScript: functionScriptFromConfig(record.config),
      parameters: functionParametersFromSchema(record.paramSchema),
      databaseSource: typeof config.dataSource === 'string' ? config.dataSource : 'primary',
      databaseSql: typeof config.sql === 'string' ? config.sql : undefined,
      databaseResultMode: config.resultMode === 'ROW' || config.resultMode === 'LIST' ? config.resultMode : 'VALUE',
    });
    setEditVisible(true);
  };

  const variableFromForm = (values: GlobalVariableForm): BrickGlobalVariable => {
    const {
      enabled,
      staticValue,
      functionScript,
      parameters,
      databaseSource,
      databaseSql,
      databaseResultMode,
      ...variable
    } = values;
    const functionParameters = parameters || [];
    return {
      ...variable,
      isEnabled: enabled === false ? 0 : 1,
      hasParams: (variable.type === 'FUNCTION' || variable.type === 'DATABASE_QUERY')
        && functionParameters.length > 0 ? 1 : 0,
      config: isStoredValueType(variable.type)
        ? JSON.stringify({ value: parseStructuredStaticValue(staticValue, variable.dataType) })
        : variable.type === 'FUNCTION'
          ? JSON.stringify({ script: functionScript })
          : variable.type === 'DATABASE_QUERY'
            ? JSON.stringify({
                dataSource: databaseSource,
                sql: databaseSql,
                resultMode: databaseResultMode || 'VALUE',
              })
            : variable.config,
      paramSchema: variable.type === 'FUNCTION' || variable.type === 'DATABASE_QUERY'
        ? JSON.stringify(functionParameters)
        : variable.paramSchema,
    };
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Global Variables</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingRecord(null);
          form.resetFields();
          form.setFieldsValue({ type: 'STATIC', dataType: 'string', enabled: true, hasParams: 0 });
          setEditVisible(true);
        }}>
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
        className="responsive-data-table"
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        tableLayout="auto"
        pagination={false}
      />

      <Modal
        title={editingRecord ? 'Edit Variable' : 'New Variable'}
        open={editVisible}
        onCancel={() => { setEditVisible(false); form.resetFields(); }}
        onOk={() => {
          form.validateFields().then((values) => {
            let variable: BrickGlobalVariable;
            try {
              variable = variableFromForm(values);
            } catch {
              message.error('Static object and array values must be valid JSON');
              return;
            }
            if (editingRecord) {
              updateMutation.mutate({ variable: { ...editingRecord, ...variable } });
            } else {
              createMutation.mutate({ variable });
            }
          });
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Variable Name"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Use letters, numbers, and underscores; do not start with a number' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={TYPE_OPTIONS}
              onChange={(type) => {
                if (type === 'DATABASE_QUERY') {
                  form.setFieldsValue({
                    databaseSource: form.getFieldValue('databaseSource') || 'primary',
                    databaseResultMode: form.getFieldValue('databaseResultMode') || 'VALUE',
                    parameters: form.getFieldValue('parameters') || [],
                  });
                }
                if (type === 'FUNCTION') {
                  form.setFieldsValue({ parameters: form.getFieldValue('parameters') || [] });
                }
              }}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Reference Syntax">
            <Input value={syntaxPreview} disabled />
          </Form.Item>
          <Form.Item name="dataType" label="Return Data Type" rules={[{ required: true }]}>
            <Select options={DATA_TYPE_OPTIONS} />
          </Form.Item>
          {isStoredValueType(selectedType) ? (
            <Form.Item
              name="staticValue"
              label={selectedType === 'TOKEN' ? 'Stored Token or Cookie' : 'Static Value'}
              rules={[
                { required: true, message: 'Enter a stored value' },
                {
                  validator: async (_, value) => {
                    if ((selectedDataType === 'object' || selectedDataType === 'array') && typeof value === 'string') {
                      const parsed = JSON.parse(value);
                      if (selectedDataType === 'object' && (Array.isArray(parsed) || parsed === null || typeof parsed !== 'object')) {
                        throw new Error('Enter a JSON object');
                      }
                      if (selectedDataType === 'array' && !Array.isArray(parsed)) {
                        throw new Error('Enter a JSON array');
                      }
                    }
                  },
                },
              ]}
            >
              {selectedType === 'TOKEN' && selectedDataType === 'string' ? (
                <Input.Password placeholder="Cookie or token value" />
              ) : selectedDataType === 'boolean' ? (
                <Select options={[{ label: 'true', value: true }, { label: 'false', value: false }]} />
              ) : (
                <Input.TextArea
                  rows={selectedDataType === 'object' || selectedDataType === 'array' ? 5 : 2}
                  placeholder={selectedDataType === 'object' ? '{"key":"value"}' : selectedDataType === 'array' ? '["value"]' : 'Value returned by this variable'}
                />
              )}
            </Form.Item>
          ) : selectedType === 'FUNCTION' ? (
            <>
              <Form.List name="parameters">
                {(fields, { add, remove }) => (
                  <Form.Item label="Parameters" style={{ marginBottom: 16 }}>
                    {fields.map(({ key, name, ...fieldProps }) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 32px', gap: 8, marginBottom: 8 }}>
                        <Form.Item
                          {...fieldProps}
                          name={[name, 'name']}
                          rules={[
                            { required: true, message: 'Enter a parameter name' },
                            { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Invalid name' },
                          ]}
                          noStyle
                        >
                          <Input placeholder="length" />
                        </Form.Item>
                        <Form.Item
                          {...fieldProps}
                          name={[name, 'type']}
                          initialValue="string"
                          rules={[{ required: true, message: 'Select a type' }]}
                          noStyle
                        >
                          <Select options={DATA_TYPE_OPTIONS} />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          aria-label="Remove parameter"
                          onClick={() => remove(name)}
                        />
                      </div>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ type: 'string' })} block>
                      Add Parameter
                    </Button>
                  </Form.Item>
                )}
              </Form.List>
              <Form.Item
                name="functionScript"
                label="JavaScript Function Body"
                rules={[
                  { required: true, message: 'Enter JavaScript that returns a value' },
                  { max: 20000, message: 'JavaScript must not exceed 20,000 characters' },
                ]}
                extra="Write the function body only. Java and host-system access are disabled; execution is limited to one second."
              >
                <Input.TextArea
                  rows={10}
                  placeholder={'const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";\nlet result = "";\nfor (let i = 0; i < length; i++) {\n  result += chars.charAt(Math.floor(Math.random() * chars.length));\n}\nreturn result;'}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                />
              </Form.Item>
            </>
          ) : selectedType === 'DATABASE_QUERY' ? (
            <>
              <Form.Item
                name="databaseSource"
                label="Configured Data Source"
                rules={[{ required: true, message: 'Select a backend-configured data source' }]}
                extra="Connection addresses and credentials are managed only by the backend."
              >
                <Select
                  options={databaseSources.map((source) => ({ value: source.id, label: source.name }))}
                  placeholder="Select a configured data source"
                />
              </Form.Item>
              <Form.List name="parameters">
                {(fields, { add, remove }) => (
                  <Form.Item label="Named SQL Parameters" style={{ marginBottom: 16 }}>
                    {fields.map(({ key, name, ...fieldProps }) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 32px', gap: 8, marginBottom: 8 }}>
                        <Form.Item
                          {...fieldProps}
                          name={[name, 'name']}
                          rules={[
                            { required: true, message: 'Enter a parameter name' },
                            { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Invalid name' },
                          ]}
                          noStyle
                        >
                          <Input placeholder="orderId" />
                        </Form.Item>
                        <Form.Item
                          {...fieldProps}
                          name={[name, 'type']}
                          initialValue="string"
                          rules={[{ required: true, message: 'Select a type' }]}
                          noStyle
                        >
                          <Select options={DATA_TYPE_OPTIONS} />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          aria-label="Remove parameter"
                          onClick={() => remove(name)}
                        />
                      </div>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ type: 'string' })} block>
                      Add SQL Parameter
                    </Button>
                  </Form.Item>
                )}
              </Form.List>
              <Form.Item
                name="databaseSql"
                label="Read-only SQL"
                rules={[{ required: true, message: 'Enter a SELECT statement' }]}
                extra="Use named parameters such as :orderId. Only one comment-free SELECT statement is accepted."
              >
                <Input.TextArea
                  rows={7}
                  placeholder="SELECT status FROM orders WHERE order_id = :orderId"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                />
              </Form.Item>
              <Form.Item name="databaseResultMode" label="Result Mode" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'VALUE', label: 'First column of first row' },
                    { value: 'ROW', label: 'First row as object' },
                    { value: 'LIST', label: 'All rows as array' },
                  ]}
                  onChange={(mode) => {
                    if (mode === 'ROW') form.setFieldValue('dataType', 'object');
                    if (mode === 'LIST') form.setFieldValue('dataType', 'array');
                  }}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Alert
                type="warning"
                showIcon
                title={`${selectedType || 'Selected'} variable execution will be implemented in the next stage.`}
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="config"
                label="Configuration JSON"
                rules={[{
                  validator: async (_, value) => {
                    if (value) JSON.parse(value);
                  },
                }]}
              >
                <Input.TextArea rows={5} placeholder="{}" />
              </Form.Item>
            </>
          )}
          <Form.Item name="category" label="Category">
            <Input placeholder="e.g. Authentication or Test Data" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
