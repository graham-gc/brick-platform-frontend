'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Form, Modal, Space, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import { isDynamicHeaderValue, parseHeaderEntries, serializeHeaderEntries, type HeaderEntry } from './headers';
import styles from './flow-designer.module.css';

interface FlowHeadersFormValues {
  headers: HeaderEntry[];
}

interface FlowHeadersModalProps {
  open: boolean;
  value?: string;
  variableNames: string[];
  onCancel: () => void;
  onSave: (value: string) => void;
}

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function FlowHeadersModal({
  open,
  value,
  variableNames,
  onCancel,
  onSave,
}: FlowHeadersModalProps) {
  const [form] = Form.useForm<FlowHeadersFormValues>();

  useEffect(() => {
    if (open) form.setFieldsValue({ headers: parseHeaderEntries(value) });
  }, [form, open, value]);

  const valueOptions = variableNames.flatMap((name) => [
    { value: `{{${name}}}`, label: `{{${name}}}` },
    { value: `Bearer {{${name}}}`, label: `Bearer {{${name}}}` },
  ]);

  return (
    <Modal
      open={open}
      width={760}
      title="Flow Headers"
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(({ headers }) => {
          const normalized = headers || [];
          const names = normalized.map((header) => header.name.trim().toLowerCase());
          if (new Set(names).size !== names.length) {
            form.setFields([{ name: ['headers'], errors: ['Header names must be unique'] }]);
            return;
          }
          onSave(serializeHeaderEntries(normalized));
        });
      }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} className={styles.editorTabContent}>
        <Alert
          type="info"
          showIcon
          title="These headers are available to every node in this flow."
          description={(
            <span>
              A node can override a header with the same name. Use a captured variable in a value,
              for example <Typography.Text code>Bearer {'{{accessToken}}'}</Typography.Text>.
              A dynamic header becomes active after its variable is available.
            </span>
          )}
        />
        <Form form={form} layout="vertical" initialValues={{ headers: parseHeaderEntries(value) }}>
          <Form.List name="headers">
            {(fields, { add, remove }, { errors }) => (
              <Space orientation="vertical" size={10} className={styles.contextList}>
                {fields.map((field) => (
                  <div className={styles.flowHeaderRow} key={field.key}>
                    <Form.Item
                      name={[field.name, 'name']}
                      label="Header Name"
                      rules={[
                        { required: true, whitespace: true, message: 'Enter a header name' },
                        { pattern: HEADER_NAME, message: 'Enter a valid HTTP header name' },
                      ]}
                    >
                      <AutoComplete
                        options={[
                          'Authorization', 'Content-Type', 'Accept', 'X-Request-Id',
                          'Idempotency-Key', 'X-API-Key',
                        ].map((name) => ({ value: name }))}
                        placeholder="Authorization"
                      />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => {
                        const headerValue = getFieldValue(['headers', field.name, 'value']) || '';
                        return (
                          <Form.Item
                            name={[field.name, 'value']}
                            label={(
                              <Space size={6}>
                                <span>Value or Template</span>
                                {isDynamicHeaderValue(headerValue) && <Tag color="purple">Dynamic</Tag>}
                              </Space>
                            )}
                            rules={[
                              { required: true, message: 'Enter a header value' },
                              {
                                validator: async (_rule, fieldValue?: string) => {
                                  if (fieldValue?.includes('\r') || fieldValue?.includes('\n')) {
                                    throw new Error('Header values cannot contain line breaks');
                                  }
                                },
                              },
                            ]}
                          >
                            <AutoComplete
                              options={valueOptions}
                              placeholder="Bearer {{accessToken}}"
                              filterOption={(input, option) => (
                                String(option?.value || '').toLowerCase().includes(input.toLowerCase())
                              )}
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      aria-label="Remove flow header"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '' })}>
                  Add Flow Header
                </Button>
                <Form.ErrorList errors={errors} />
              </Space>
            )}
          </Form.List>
        </Form>
      </Space>
    </Modal>
  );
}
