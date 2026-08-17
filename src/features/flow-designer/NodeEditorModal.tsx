'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, AutoComplete, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Tabs, Tag, TreeSelect, Typography, message } from 'antd';
import type { Rule } from 'antd/es/form';
import * as api from '@/services/api';
import type { BrickFlowNode, BrickFlowNodeAssertion, EndpointParameterDefinition } from '@/types';
import type { HttpCanvasNode } from './model';
import {
  arrayFilterFieldOptions,
  hasArraySelection,
  isJsonPathShapeValid,
  parseRequestVariableBindings,
  parseResponseVariables,
  prepareResponseVariablesForSave,
  requestBodyFieldTree,
  responseFieldTree,
  responseVariableExpression,
  type AvailableFlowVariable,
  type FlowRequestVariableBinding,
  type FlowResponseVariable,
  type FlowResponseSelectorMode,
} from './context-variables';
import {
  createInitialNodeRequest,
  parseRequestDefinition,
  prettyStoredJson,
} from './request-definition';
import { isDynamicHeaderValue, parseHeaderEntries } from './headers';
import styles from './flow-designer.module.css';

const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

const FILTER_OPERATOR_OPTIONS = ['==', '!=', '>', '>=', '<', '<=']
  .map((operator) => ({ value: operator, label: operator }));

const CUSTOM_RESULT_MODE_OPTIONS = [
  { value: 'SINGLE', label: 'Exactly one value' },
  { value: 'FIRST', label: 'First matching value' },
  { value: 'LIST', label: 'List of all values' },
];

interface NodeEditorValues {
  payloadJson?: string;
  queryParamsJson: string;
  pathVarsJson: string;
  headersJson: string;
  timeoutSec: number;
  retries: number;
  joinMode: 'ALL' | 'ANY';
  responseVariables: FlowResponseVariable[];
  requestBindings: FlowRequestVariableBinding[];
  assertions: AssertionFormItem[];
}

interface AssertionFormItem {
  id?: number;
  assertionType: 'status_code' | 'json_path' | 'header' | 'response_time';
  fieldPath?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'regex';
  expectedValue: string;
  isEnabled: boolean;
}

interface NodeEditorModalProps {
  node: HttpCanvasNode;
  availableVariables: AvailableFlowVariable[];
  reservedVariableNames: string[];
  inheritedHeadersJson?: string;
  onCancel: () => void;
  onSave: (updates: Partial<BrickFlowNode>) => void;
}

function jsonRule(label: string, objectOnly = false): Rule {
  return {
    validator: async (_rule, value?: string) => {
      if (!value?.trim()) return;
      try {
        const parsed = JSON.parse(value);
        if (objectOnly && (parsed == null || Array.isArray(parsed) || typeof parsed !== 'object')) {
          throw new Error();
        }
      } catch {
        throw new Error(`${label} must be valid ${objectOnly ? 'JSON object' : 'JSON'}`);
      }
    },
  };
}

function ParameterSummary({ parameters }: { parameters?: EndpointParameterDefinition[] }) {
  if (!parameters?.length) {
    return <Alert type="info" showIcon title="This endpoint does not define any parameters here." />;
  }
  return (
    <div className={styles.parameterSummary}>
      {parameters.map((parameter) => (
        <Tag key={`${parameter.in}-${parameter.name}`} color={parameter.required ? 'red' : 'default'}>
          {parameter.name}
          {typeof parameter.schema?.type === 'string' ? ` · ${parameter.schema.type}` : ''}
          {parameter.required ? ' · required' : ''}
        </Tag>
      ))}
    </div>
  );
}

export function NodeEditorModal({
  node,
  availableVariables,
  reservedVariableNames,
  inheritedHeadersJson,
  onCancel,
  onSave,
}: NodeEditorModalProps) {
  const [form] = Form.useForm<NodeEditorValues>();
  const endpoint = node.data.endpoint;
  const definition = parseRequestDefinition(endpoint);
  const defaults = endpoint ? createInitialNodeRequest(endpoint) : {};
  const flowNode = node.data.flowNode;

  const { data: endpointDetail, isLoading: responseSchemaLoading } = useQuery({
    queryKey: ['endpoint-detail', endpoint?.id],
    queryFn: () => api.getEndpointDetail(endpoint!.id!),
    enabled: endpoint?.id != null,
  });

  const { data: assertionsData = [], refetch: refetchAssertions } = useQuery({
    queryKey: ['node-assertions', flowNode.id],
    queryFn: () => api.getNodeAssertions(flowNode.id!),
    enabled: !!flowNode.id,
  });

  const initialValues: NodeEditorValues = {
    payloadJson: flowNode.payloadJson?.trim()
      ? prettyStoredJson(flowNode.payloadJson, {})
      : definition.requestBody
        ? prettyStoredJson(undefined, definition.requestBody.example ?? {})
        : undefined,
    queryParamsJson: prettyStoredJson(flowNode.queryParamsJson, JSON.parse(defaults.queryParamsJson || '{}')),
    pathVarsJson: prettyStoredJson(flowNode.pathVarsJson, JSON.parse(defaults.pathVarsJson || '{}')),
    headersJson: prettyStoredJson(flowNode.headersJson, JSON.parse(defaults.headersJson || '{}')),
    timeoutSec: flowNode.timeoutSec ?? 30,
    retries: flowNode.retries ?? 0,
    joinMode: flowNode.joinMode ?? 'ALL',
    responseVariables: parseResponseVariables(flowNode),
    requestBindings: parseRequestVariableBindings(flowNode),
    assertions: assertionsData.map((a): AssertionFormItem => ({
      id: a.id,
      assertionType: a.assertionType ?? 'status_code',
      fieldPath: a.fieldPath ?? '',
      operator: a.operator ?? 'equals',
      expectedValue: a.expectedValue ?? '',
      isEnabled: !!a.isEnabled,
    })),
  };
  const payloadJson = Form.useWatch('payloadJson', form) ?? initialValues.payloadJson;
  const requestBindings = Form.useWatch('requestBindings', form) ?? initialValues.requestBindings;
  const [messageApi, contextHolder] = message.useMessage();

  const saveAssertionsMutation = useMutation({
    mutationFn: (assertions: BrickFlowNodeAssertion[]) =>
      api.updateNodeAssertions(flowNode.id!, assertions, 'admin'),
  });

  useEffect(() => {
    if (saveAssertionsMutation.isSuccess) {
      messageApi.success('Assertions saved');
      refetchAssertions();
    }
  }, [saveAssertionsMutation.isSuccess, messageApi, refetchAssertions]);

  useEffect(() => {
    if (saveAssertionsMutation.isError) {
      messageApi.error(saveAssertionsMutation.error?.message ?? 'Failed to save assertions');
    }
  }, [saveAssertionsMutation.isError, saveAssertionsMutation.error, messageApi]);
  const resolvedDefinition = endpointDetail?.resolvedRequestDefinition
    || endpointDetail?.requestDefinition
    || definition;
  const responseFields = responseFieldTree(resolvedDefinition.responses);
  const bodyFields = requestBodyFieldTree(payloadJson, resolvedDefinition.requestBody?.schema);
  const queryFields = Array.from(new Set(
    (resolvedDefinition.queryParameters || []).map((parameter) => parameter.name)
  ));
  const pathFields = Array.from(new Set(
    (resolvedDefinition.pathParameters || []).map((parameter) => parameter.name)
  ));
  const headerFields = Array.from(new Set([
    ...(resolvedDefinition.headers || []).map((parameter) => parameter.name),
    'Authorization',
    'Content-Type',
    'Accept',
    'X-Request-Id',
    'Idempotency-Key',
    'X-API-Key',
  ]));
  const inheritedHeaders = parseHeaderEntries(inheritedHeadersJson);
  const requestAreaOptions = [
    ...(resolvedDefinition.requestBody
      ? [{ value: 'BODY' as const, label: 'Request Body' }]
      : []),
    ...(queryFields.length
      ? [{ value: 'QUERY' as const, label: `Query Parameters (${queryFields.length})` }]
      : []),
    ...(pathFields.length
      ? [{ value: 'PATH' as const, label: `Path Parameters (${pathFields.length})` }]
      : []),
    { value: 'HEADER' as const, label: 'Headers' },
  ];
  const availableVariableNames = new Set(availableVariables.map((variable) => variable.name));
  const missingVariableNames = Array.from(new Set(
    (requestBindings || [])
      .map((binding) => binding?.variableName)
      .filter((name): name is string => !!name && !availableVariableNames.has(name))
  ));
  const variableOptions = [
    ...availableVariables.map((variable) => ({
      value: variable.name,
      label: variable.name,
      searchText: [
        variable.name,
        variable.sourceNodeMethod,
        variable.sourceNodePath,
        variable.responsePath,
      ].join(' '),
      variable,
      missing: false,
      disabled: false,
    })),
    ...missingVariableNames.map((name) => ({
      value: name,
      label: `${name} (missing)`,
      searchText: `${name} missing`,
      variable: undefined,
      missing: true,
      disabled: true,
    })),
  ];

  const parameterTab = (
    field: 'queryParamsJson' | 'pathVarsJson',
    label: string,
    parameters?: EndpointParameterDefinition[]
  ) => ({
    key: field,
    label,
    children: (
      <Space orientation="vertical" size={12} className={styles.editorTabContent}>
        <ParameterSummary parameters={parameters} />
        <Form.Item name={field} rules={[jsonRule(label, true)]}>
          <Input.TextArea className={styles.jsonEditor} rows={13} spellCheck={false} />
        </Form.Item>
      </Space>
    ),
  });

  return (
    <Modal
      open
      width={1040}
      title={(
        <Space wrap>
          <span>Edit HTTP Node</span>
          <Tag color="blue">{node.data.method}</Tag>
          <Typography.Text code>{node.data.path}</Typography.Text>
        </Space>
      )}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then((values) => {
          const assertionsPayload: BrickFlowNodeAssertion[] = (values.assertions || []).map(
            (item: AssertionFormItem) => ({
              id: item.id,
              nodeId: flowNode.id,
              assertionType: item.assertionType,
              fieldPath: item.fieldPath || undefined,
              operator: item.operator,
              expectedValue: item.expectedValue,
              isEnabled: item.isEnabled ? 1 : 0,
            })
          );
          onSave({
            payloadJson: values.payloadJson?.trim() || undefined,
            queryParamsJson: values.queryParamsJson,
            pathVarsJson: values.pathVarsJson,
            headersJson: values.headersJson,
            timeoutSec: values.timeoutSec,
            retries: values.retries,
            joinMode: values.joinMode,
            responseVariablesJson: JSON.stringify(
              prepareResponseVariablesForSave(values.responseVariables)
            ),
            requestVariableBindingsJson: JSON.stringify(values.requestBindings || []),
          });
          if (flowNode.id) {
            void saveAssertionsMutation.mutateAsync(assertionsPayload);
          }
        });
      }}
      destroyOnHidden
    >
      {contextHolder}
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Tabs
          defaultActiveKey={missingVariableNames.length ? 'variableBindings' : undefined}
          items={[
            {
              key: 'body',
              label: 'Request Body',
              children: (
                <Space orientation="vertical" size={12} className={styles.editorTabContent}>
                  {definition.requestBody ? (
                    <Space wrap>
                      <Tag color="blue">{definition.requestBody.contentType || 'unknown content type'}</Tag>
                      {definition.requestBody.required && <Tag color="red">required</Tag>}
                    </Space>
                  ) : (
                    <Alert type="info" showIcon title="This endpoint does not define a request body." />
                  )}
                  <Form.Item name="payloadJson" rules={[jsonRule('Request Body')]}>
                    <Input.TextArea
                      className={styles.jsonEditor}
                      rows={13}
                      spellCheck={false}
                      placeholder="No request body"
                    />
                  </Form.Item>
                </Space>
              ),
            },
            parameterTab('queryParamsJson', 'Query Parameters', definition.queryParameters),
            parameterTab('pathVarsJson', 'Path Parameters', definition.pathParameters),
            {
              key: 'headersJson',
              label: 'Headers',
              children: (
                <Space orientation="vertical" size={14} className={styles.editorTabContent}>
                  <Alert
                    type="info"
                    showIcon
                    title="Flow Headers are inherited first; Node Headers override matching names."
                    description="Header names are case-insensitive. Variable bindings are applied to this node after both layers are merged."
                  />
                  <div className={styles.headerLayer}>
                    <Typography.Text strong>Inherited Flow Headers</Typography.Text>
                    {inheritedHeaders.length ? (
                      <div className={styles.headerEntries}>
                        {inheritedHeaders.map((header) => (
                          <div className={styles.headerEntry} key={header.name.toLowerCase()}>
                            <Typography.Text code>{header.name}</Typography.Text>
                            <Typography.Text ellipsis={{ tooltip: header.value }}>{header.value}</Typography.Text>
                            {isDynamicHeaderValue(header.value) && <Tag color="purple">Dynamic</Tag>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Typography.Text type="secondary">No Flow Headers configured.</Typography.Text>
                    )}
                  </div>
                  <div className={styles.headerLayer}>
                    <Space orientation="vertical" size={8} className={styles.editorTabContent}>
                      <div>
                        <Typography.Text strong>Node Headers</Typography.Text>
                        <Typography.Text type="secondary"> · only applied to this node</Typography.Text>
                      </div>
                      <ParameterSummary parameters={resolvedDefinition.headers} />
                      <Form.Item name="headersJson" rules={[jsonRule('Headers', true)]}>
                        <Input.TextArea className={styles.jsonEditor} rows={9} spellCheck={false} />
                      </Form.Item>
                    </Space>
                  </div>
                </Space>
              ),
            },
            {
              key: 'responseVariables',
              label: 'Response Variables',
              children: (
                <Space orientation="vertical" size={12} className={styles.editorTabContent}>
                  <Alert
                    type="info"
                    showIcon
                    title="Create flow-scoped variables from this node's JSON response."
                    description="Only downstream nodes connected to this node can use these variables."
                  />
                  {!responseSchemaLoading && responseFields.length === 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      title="No response schema is available"
                      description="Sync this Swagger mapping again after the response-schema importer is enabled."
                    />
                  )}
                  <Form.List name="responseVariables">
                    {(fields, { add, remove }) => (
                      <Space orientation="vertical" size={10} className={styles.contextList}>
                        {fields.map((field) => (
                          <Form.Item key={field.key} noStyle shouldUpdate>
                            {({ getFieldValue }) => {
                              const variable = (getFieldValue(['responseVariables', field.name]) || {}) as FlowResponseVariable;
                              const selectorMode = variable.selectorMode || 'DIRECT';
                              const fieldPath = variable.fieldPath;
                              const containsArray = hasArraySelection(fieldPath);
                              const showExtractionMode = containsArray || selectorMode === 'CUSTOM';
                              const filterFields = arrayFilterFieldOptions(responseFields, fieldPath);
                              const expression = responseVariableExpression(variable);
                              const extractionOptions = containsArray
                                ? [
                                  { value: 'INDEX', label: 'Array item by index' },
                                  { value: 'FILTER_FIRST', label: 'First item matching a condition' },
                                  { value: 'ALL', label: 'All matching items' },
                                  { value: 'CUSTOM', label: 'Custom JSONPath' },
                                ]
                                : [
                                  { value: 'DIRECT', label: 'Direct field' },
                                  { value: 'CUSTOM', label: 'Custom JSONPath' },
                                ];

                              return (
                                <div className={styles.contextVariableCard}>
                                  <div className={`${styles.contextPrimaryRow} ${
                                    showExtractionMode ? '' : styles.contextPrimaryRowSimple
                                  }`}>
                                    <Form.Item
                                      name={[field.name, 'name']}
                                      label="Variable Name"
                                      rules={[
                                        { required: true, message: 'Enter a variable name' },
                                        { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Use letters, numbers and underscores' },
                                        {
                                          validator: async (_rule, value?: string) => {
                                            if (value && reservedVariableNames.includes(value)) {
                                              throw new Error(`Variable ${value} already exists in this flow`);
                                            }
                                            const names = (form.getFieldValue('responseVariables') || [])
                                              .map((item: FlowResponseVariable) => item?.name)
                                              .filter((name: string) => name === value);
                                            if (value && names.length > 1) {
                                              throw new Error(`Variable ${value} is duplicated`);
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input placeholder="productId" />
                                    </Form.Item>
                                    {showExtractionMode && (
                                      <Form.Item
                                        name={[field.name, 'selectorMode']}
                                        label={containsArray ? 'Array Selection' : 'Extraction Mode'}
                                        rules={[{ required: true }]}
                                      >
                                        <Select
                                          options={extractionOptions}
                                          onChange={(mode: FlowResponseSelectorMode) => {
                                            if (mode === 'CUSTOM') {
                                              form.setFieldValue(
                                                ['responseVariables', field.name, 'responsePath'],
                                                expression
                                              );
                                            }
                                            if (mode === 'INDEX' && variable.arrayIndex == null) {
                                              form.setFieldValue(
                                                ['responseVariables', field.name, 'arrayIndex'],
                                                0
                                              );
                                            }
                                            if (mode === 'FILTER_FIRST' && !variable.filterOperator) {
                                              form.setFieldValue(
                                                ['responseVariables', field.name, 'filterOperator'],
                                                '=='
                                              );
                                            }
                                          }}
                                        />
                                      </Form.Item>
                                    )}
                                    <Button
                                      type="text"
                                      danger
                                      aria-label="Remove response variable"
                                      icon={<MinusCircleOutlined />}
                                      onClick={() => remove(field.name)}
                                    />
                                  </div>

                                  {selectorMode !== 'CUSTOM' && (
                                    <Form.Item
                                      name={[field.name, 'fieldPath']}
                                      label="Response Field"
                                      rules={[{ required: true, message: 'Select a response field' }]}
                                    >
                                      <TreeSelect
                                        treeData={responseFields}
                                        treeDefaultExpandAll
                                        showSearch
                                        treeNodeFilterProp="title"
                                        loading={responseSchemaLoading}
                                        placeholder="Select from the response schema"
                                        onChange={(value: string) => {
                                          const mode = form.getFieldValue([
                                            'responseVariables', field.name, 'selectorMode',
                                          ]);
                                          if (hasArraySelection(value) && (mode === 'DIRECT' || !mode)) {
                                            form.setFieldValue(
                                              ['responseVariables', field.name, 'selectorMode'],
                                              'INDEX'
                                            );
                                            form.setFieldValue(
                                              ['responseVariables', field.name, 'arrayIndex'],
                                              0
                                            );
                                          } else if (!hasArraySelection(value) && mode !== 'CUSTOM') {
                                            form.setFieldValue(
                                              ['responseVariables', field.name, 'selectorMode'],
                                              'DIRECT'
                                            );
                                          }
                                        }}
                                      />
                                    </Form.Item>
                                  )}

                                  {selectorMode === 'INDEX' && (
                                    <Form.Item
                                      name={[field.name, 'arrayIndex']}
                                      label="Array Index"
                                      rules={[{ required: true, message: 'Enter an array index' }]}
                                    >
                                      <InputNumber min={0} precision={0} placeholder="0" />
                                    </Form.Item>
                                  )}

                                  {selectorMode === 'FILTER_FIRST' && (
                                    <div className={styles.filterBuilder}>
                                      <Form.Item
                                        name={[field.name, 'filterField']}
                                        label="Condition Field"
                                        rules={[{ required: true, message: 'Select a condition field' }]}
                                      >
                                        <AutoComplete
                                          options={filterFields}
                                          placeholder="stock"
                                          filterOption={(input, option) => String(option?.value || '')
                                            .toLowerCase().includes(input.toLowerCase())}
                                        />
                                      </Form.Item>
                                      <Form.Item
                                        name={[field.name, 'filterOperator']}
                                        label="Operator"
                                        rules={[{ required: true }]}
                                      >
                                        <Select options={FILTER_OPERATOR_OPTIONS} />
                                      </Form.Item>
                                      <Form.Item
                                        name={[field.name, 'filterValue']}
                                        label="Value"
                                        rules={[{ required: true, message: 'Enter a comparison value' }]}
                                      >
                                        <Input placeholder="0 or models" />
                                      </Form.Item>
                                    </div>
                                  )}

                                  {selectorMode === 'CUSTOM' && (
                                    <div className={styles.customExpressionRow}>
                                      <Form.Item
                                        name={[field.name, 'responsePath']}
                                        label="JSONPath Expression"
                                        rules={[
                                          { required: true, message: 'Enter a JSONPath expression' },
                                          {
                                            validator: async (_rule, value?: string) => {
                                              if (value && !isJsonPathShapeValid(value)) {
                                                throw new Error('JSONPath must start with $ and contain balanced brackets');
                                              }
                                            },
                                          },
                                        ]}
                                      >
                                        <Input placeholder="$.data.items[?(@.stock > 0)].id" />
                                      </Form.Item>
                                      <Form.Item
                                        name={[field.name, 'resultMode']}
                                        label="Result Handling"
                                        rules={[{ required: true }]}
                                      >
                                        <Select options={CUSTOM_RESULT_MODE_OPTIONS} />
                                      </Form.Item>
                                    </div>
                                  )}

                                  <div className={styles.expressionPreview}>
                                    <Typography.Text type="secondary">JSONPath</Typography.Text>
                                    <Typography.Text code copyable={!!expression}>
                                      {expression || 'Complete the fields above to generate an expression'}
                                    </Typography.Text>
                                  </div>
                                </div>
                              );
                            }}
                          </Form.Item>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({
                            name: '',
                            responsePath: '',
                            fieldPath: undefined,
                            selectorMode: 'DIRECT',
                            resultMode: 'SINGLE',
                            arrayIndex: 0,
                            filterOperator: '==',
                          })}
                          disabled={responseFields.length === 0}
                        >
                          Add Response Variable
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Space>
              ),
            },
            {
              key: 'variableBindings',
              label: 'Variable Bindings',
              children: (
                <Space orientation="vertical" size={12} className={styles.editorTabContent}>
                  <Alert
                    type="info"
                    showIcon
                    title="Assign a flow variable to a request field before this node executes."
                  />
                  {availableVariables.length === 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      title="No upstream variables are available"
                      description="Connect this node downstream from a node that exports a response variable."
                    />
                  )}
                  {missingVariableNames.length > 0 && (
                    <Alert
                      type="error"
                      showIcon
                      title="This node contains invalid variable bindings"
                      description={`Missing flow variable${missingVariableNames.length === 1 ? '' : 's'}: ${missingVariableNames.join(', ')}. Select an existing upstream variable or remove the binding.`}
                    />
                  )}
                  {requestAreaOptions.length === 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      title="This endpoint has no bindable request areas"
                      description="Its Swagger definition contains no request body, query parameters, or path parameters."
                    />
                  )}
                  <Form.List name="requestBindings">
                    {(fields, { add, remove }) => (
                      <Space orientation="vertical" size={10} className={styles.contextList}>
                        {fields.map((field) => (
                          <div className={styles.bindingRow} key={field.key}>
                            <Form.Item
                              name={[field.name, 'variableName']}
                              label="Flow Variable"
                              rules={[
                                { required: true, message: 'Select a variable' },
                                {
                                  validator: async (_rule, value?: string) => {
                                    if (value && !availableVariableNames.has(value)) {
                                      throw new Error(`Flow variable “${value}” no longer exists`);
                                    }
                                  },
                                },
                              ]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="searchText"
                                options={variableOptions}
                                optionRender={(option) => {
                                  const variable = option.data.variable;
                                  if (!variable) {
                                    return (
                                      <Space>
                                        <Typography.Text type="danger">{option.value}</Typography.Text>
                                        <Tag color="red">Missing variable</Tag>
                                      </Space>
                                    );
                                  }
                                  return (
                                    <div className={styles.variableOption}>
                                      <div className={styles.variableOptionHeader}>
                                        <span>{variable.name}</span>
                                        <Tag color={METHOD_COLORS[variable.sourceNodeMethod] || 'default'}>
                                          {variable.sourceNodeMethod}
                                        </Tag>
                                      </div>
                                      <div
                                        className={styles.variableOptionPath}
                                        title={variable.sourceNodePath}
                                      >
                                        {variable.sourceNodePath}
                                      </div>
                                      <div
                                        className={styles.variableOptionResponse}
                                        title={variable.responsePath}
                                      >
                                        Response: {variable.responsePath}
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'targetType']}
                              label="Request Area"
                              rules={[{ required: true, message: 'Select a request area' }]}
                            >
                              <Select
                                options={requestAreaOptions}
                                onChange={() => {
                                  form.setFieldValue(
                                    ['requestBindings', field.name, 'targetPath'],
                                    undefined
                                  );
                                }}
                              />
                            </Form.Item>
                            <Form.Item noStyle shouldUpdate>
                              {({ getFieldValue }) => {
                                const targetType = getFieldValue(['requestBindings', field.name, 'targetType']);
                                const targetOptions = targetType === 'QUERY'
                                  ? queryFields
                                  : targetType === 'PATH'
                                    ? pathFields
                                    : headerFields;
                                return (
                                  <div className={styles.bindingTargetGroup}>
                                    <Form.Item
                                      name={[field.name, 'targetPath']}
                                      label="Target Field"
                                      rules={[
                                        { required: true, message: 'Select a target field' },
                                        {
                                          validator: async (_rule, value?: string) => {
                                            if (targetType === 'HEADER' && value
                                              && !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value)) {
                                              throw new Error('Enter a valid HTTP header name');
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      {targetType === 'BODY' ? (
                                        <TreeSelect
                                          treeData={bodyFields}
                                          treeDefaultExpandAll
                                          showSearch
                                          treeNodeFilterProp="title"
                                          placeholder="Select a body field"
                                        />
                                      ) : targetType === 'HEADER' ? (
                                        <AutoComplete
                                          options={targetOptions.map((name) => ({ value: name }))}
                                          placeholder="Header name"
                                          filterOption={(input, option) => (
                                            String(option?.value || '').toLowerCase().includes(input.toLowerCase())
                                          )}
                                        />
                                      ) : (
                                        <Select
                                          disabled={!targetType}
                                          options={targetOptions.map((name) => ({ value: name, label: name }))}
                                          placeholder={targetType ? 'Select a request field' : 'Select an area first'}
                                        />
                                      )}
                                    </Form.Item>
                                    {targetType === 'HEADER' && (
                                      <Form.Item
                                        name={[field.name, 'valueTemplate']}
                                        label="Value Template"
                                        tooltip="Use {{value}} where the selected flow variable should be inserted. Leave blank to use the raw value."
                                        rules={[{
                                          validator: async (_rule, value?: string) => {
                                            if (value?.trim() && !value.includes('{{value}}')) {
                                              throw new Error('The template must contain {{value}}');
                                            }
                                            if (value?.includes('\r') || value?.includes('\n')) {
                                              throw new Error('Header values cannot contain line breaks');
                                            }
                                          },
                                        }]}
                                      >
                                        <Input placeholder="Bearer {{value}}" />
                                      </Form.Item>
                                    )}
                                  </div>
                                );
                              }}
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              aria-label="Remove variable binding"
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({
                            variableName: undefined,
                            targetType: requestAreaOptions.length === 1
                              ? requestAreaOptions[0].value
                              : undefined,
                            targetPath: undefined,
                            valueTemplate: undefined,
                          })}
                          disabled={availableVariables.length === 0 || requestAreaOptions.length === 0}
                        >
                          Add Variable Binding
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Space>
              ),
            },
            {
              key: 'settings',
              label: 'Settings',
              children: (
                <div className={styles.settingsGrid}>
                  <Form.Item name="timeoutSec" label="Timeout (seconds)" rules={[{ required: true }]}>
                    <InputNumber min={1} max={3600} precision={0} />
                  </Form.Item>
                  <Form.Item name="retries" label="Retries" rules={[{ required: true }]}>
                    <InputNumber min={0} max={10} precision={0} />
                  </Form.Item>
                  <Form.Item
                    name="joinMode"
                    label="Incoming Branches"
                    rules={[{ required: true }]}
                    tooltip="Controls when this node can run if it has multiple incoming edges."
                  >
                    <Select
                      options={[
                        { value: 'ALL', label: 'Wait for all successful branches (ALL)' },
                        { value: 'ANY', label: 'Run after any successful branch (ANY)' },
                      ]}
                    />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'assertions',
              label: 'Assertions',
              children: (
                <Space orientation="vertical" size={12} className={styles.editorTabContent}>
                  <Alert
                    type="info"
                    showIcon
                    title="Configure assertions to validate the response from this node."
                    description="Assertions run after the node receives a response. Failed assertions mark the node as failed."
                  />
                  <Form.List name="assertions">
                    {(fields, { add, remove }) => (
                      <Space orientation="vertical" size={10} className={styles.contextList}>
                        {fields.map((field) => (
                          <Form.Item key={field.key} noStyle shouldUpdate>
                            {({ getFieldValue }) => {
                              const assertion = (getFieldValue(['assertions', field.name]) || {}) as AssertionFormItem;
                              const assertionType = assertion.assertionType || 'status_code';
                              const needsFieldPath = assertionType === 'json_path' || assertionType === 'header';
                              const numericOperators = [
                                { value: 'equals', label: 'equals' },
                                { value: 'not_equals', label: 'not equals' },
                                { value: 'gt', label: '>' },
                                { value: 'lt', label: '<' },
                                { value: 'gte', label: '>=' },
                                { value: 'lte', label: '<=' },
                              ];
                              const textOperators = [
                                { value: 'equals', label: 'equals' },
                                { value: 'not_equals', label: 'not equals' },
                                { value: 'contains', label: 'contains' },
                                { value: 'not_contains', label: 'not contains' },
                                { value: 'regex', label: 'regex' },
                              ];
                              const operators = needsFieldPath ? textOperators : numericOperators;

                              return (
                                <div className={styles.assertionRow}>
                                  <Form.Item
                                    name={[field.name, 'assertionType']}
                                    label="Type"
                                    rules={[{ required: true }]}
                                  >
                                    <Select
                                      options={[
                                        { value: 'status_code', label: 'Status Code' },
                                        { value: 'json_path', label: 'JSON Path' },
                                        { value: 'header', label: 'Header' },
                                        { value: 'response_time', label: 'Response Time (ms)' },
                                      ]}
                                    />
                                  </Form.Item>
                                  {needsFieldPath && (
                                    assertionType === 'json_path' ? (
                                      <Form.Item
                                        name={[field.name, 'fieldPath']}
                                        label="Field Path"
                                        rules={[{ required: true, message: 'Field path is required' }]}
                                      >
                                        <TreeSelect
                                          treeData={responseFields}
                                          treeDefaultExpandAll
                                          showSearch
                                          treeNodeFilterProp="title"
                                          loading={responseSchemaLoading}
                                          placeholder="Select from response schema"
                                        />
                                      </Form.Item>
                                    ) : (
                                      <Form.Item
                                        name={[field.name, 'fieldPath']}
                                        label="Header Name"
                                        rules={[{ required: true, message: 'Header name is required' }]}
                                      >
                                        <AutoComplete
                                          options={headerFields.map((name) => ({ value: name }))}
                                          placeholder="Content-Type"
                                          filterOption={(input, option) =>
                                            String(option?.value || '').toLowerCase().includes(input.toLowerCase())
                                          }
                                        />
                                      </Form.Item>
                                    )
                                  )}
                                  <Form.Item
                                    name={[field.name, 'operator']}
                                    label="Operator"
                                    rules={[{ required: true }]}
                                  >
                                    <Select options={operators} />
                                  </Form.Item>
                                  <Form.Item
                                    name={[field.name, 'expectedValue']}
                                    label="Expected"
                                    rules={[{ required: true, message: 'Expected value is required' }]}
                                  >
                                    <Input placeholder={assertionType === 'status_code' ? '200' : 'value'} />
                                  </Form.Item>
                                  <Form.Item
                                    name={[field.name, 'isEnabled']}
                                    label="Enabled"
                                    valuePropName="checked"
                                  >
                                    <Switch />
                                  </Form.Item>
                                  <Button
                                    type="text"
                                    danger
                                    aria-label="Remove assertion"
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(field.name)}
                                    style={{ marginTop: 24 }}
                                  />
                                </div>
                              );
                            }}
                          </Form.Item>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({
                            assertionType: 'status_code',
                            fieldPath: '',
                            operator: 'equals',
                            expectedValue: '200',
                            isEnabled: true,
                          })}
                        >
                          Add Assertion
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Space>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
