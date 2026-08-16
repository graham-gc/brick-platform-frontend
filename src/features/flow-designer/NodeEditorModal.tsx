'use client';

import { Alert, Form, Input, InputNumber, Modal, Space, Tabs, Tag, Typography } from 'antd';
import type { Rule } from 'antd/es/form';
import type { BrickFlowNode, EndpointParameterDefinition } from '@/types';
import type { HttpCanvasNode } from './model';
import {
  createInitialNodeRequest,
  parseRequestDefinition,
  prettyStoredJson,
} from './request-definition';
import styles from './flow-designer.module.css';

interface NodeEditorValues {
  payloadJson?: string;
  queryParamsJson: string;
  pathVarsJson: string;
  headersJson: string;
  timeoutSec: number;
  retries: number;
}

interface NodeEditorModalProps {
  node: HttpCanvasNode;
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

export function NodeEditorModal({ node, onCancel, onSave }: NodeEditorModalProps) {
  const [form] = Form.useForm<NodeEditorValues>();
  const endpoint = node.data.endpoint;
  const definition = parseRequestDefinition(endpoint);
  const defaults = endpoint ? createInitialNodeRequest(endpoint) : {};
  const flowNode = node.data.flowNode;
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
  };

  const parameterTab = (
    field: 'queryParamsJson' | 'pathVarsJson' | 'headersJson',
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
      width={900}
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
          onSave({
            payloadJson: values.payloadJson?.trim() || undefined,
            queryParamsJson: values.queryParamsJson,
            pathVarsJson: values.pathVarsJson,
            headersJson: values.headersJson,
            timeoutSec: values.timeoutSec,
            retries: values.retries,
          });
        });
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={initialValues} preserve={false}>
        <Tabs
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
            parameterTab('headersJson', 'Headers', definition.headers),
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
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
