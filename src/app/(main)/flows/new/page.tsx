'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntdApp, Form, Input, Select, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import * as api from '@/services/api';
import { FlowDesigner } from '@/features/flow-designer/FlowDesigner';
import type { FlowCanvasSavePayload } from '@/features/flow-designer/model';
import type { AppSwaggerMapping, BrickFlow } from '@/types';
import styles from './new-flow.module.css';

interface FlowSetupValues {
  swaggerMappingId: number;
  description?: string;
}

interface CreateFlowVariables {
  payload: FlowCanvasSavePayload;
  values: FlowSetupValues;
  mapping: AppSwaggerMapping;
  name: string;
}

export default function NewFlowPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FlowSetupValues>();
  const [flowName, setFlowName] = useState('Untitled Flow');
  const swaggerMappingId = Form.useWatch('swaggerMappingId', form);
  const description = Form.useWatch('description', form);

  const { data: mappings, isLoading: mappingsLoading, error: mappingsError } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const selectedMapping = useMemo(
    () => mappings?.find((mapping) => mapping.id === swaggerMappingId),
    [mappings, swaggerMappingId]
  );

  const { data: endpoints, isLoading: endpointsLoading, error: endpointsError } = useQuery({
    queryKey: ['endpoints', swaggerMappingId],
    queryFn: () => api.getAllEndpoints(swaggerMappingId!),
    enabled: swaggerMappingId != null,
  });

  const createMutation = useMutation({
    mutationFn: ({ payload, values, mapping, name }: CreateFlowVariables) => api.createFlow({
      flow: {
        name,
        description: values.description?.trim(),
        swaggerMappingId: mapping.id,
        appConfigId: mapping.appConfigId,
        env: mapping.env,
        status: 'draft',
        version: 1,
        viewportX: payload.viewport.x,
        viewportY: payload.viewport.y,
        viewportZoom: payload.viewport.zoom,
      },
      nodes: payload.nodes,
      edges: payload.edges,
      operator: 'admin',
    }),
    onSuccess: (createdFlow) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      message.success('Flow created successfully');
      if (createdFlow.id == null) {
        message.error('The backend created the flow without returning its ID');
        return;
      }
      router.replace(`/flows/${createdFlow.id}`);
    },
    onError: (error: Error) => message.error(error.message),
  });

  const draftFlow: BrickFlow = {
    name: flowName,
    description,
    swaggerMappingId,
    appConfigId: selectedMapping?.appConfigId,
    env: selectedMapping?.env,
    status: 'draft',
    version: 1,
  };

  const handleSave = async (payload: FlowCanvasSavePayload) => {
    if (!flowName.trim()) {
      message.error('Enter a flow name');
      throw new Error('Flow name is required');
    }
    const values = await form.validateFields();
    const mapping = mappings?.find((item) => item.id === values.swaggerMappingId);
    if (!mapping) {
      message.error('Select a valid application before saving');
      throw new Error('Application mapping not found');
    }
    await createMutation.mutateAsync({ payload, values, mapping, name: flowName.trim() });
  };

  const loadError = mappingsError || endpointsError;

  return (
    <FlowDesigner
      key={swaggerMappingId == null ? 'new-flow' : `new-flow-${swaggerMappingId}`}
      flow={draftFlow}
      persistedNodes={[]}
      persistedEdges={[]}
      endpoints={endpoints || []}
      saving={createMutation.isPending}
      running={false}
      titleContent={(
        <Typography.Title
          className={styles.editableTitle}
          level={4}
          editable={{
            tooltip: 'Edit flow name',
            maxLength: 200,
            onChange: setFlowName,
          }}
        >
          {flowName}
        </Typography.Title>
      )}
      onBack={() => router.push('/flows')}
      onSave={handleSave}
      headerContent={(
        <div className={styles.setupPanel}>
          {loadError && (
            <Alert
              className={styles.setupAlert}
              type="error"
              showIcon
              message="Unable to load flow setup data"
              description={loadError.message}
            />
          )}
          <Form
            form={form}
            layout="inline"
            className={styles.setupForm}
          >
            <Form.Item
              className={styles.applicationField}
              name="swaggerMappingId"
              label={(
                <span>
                  Application{' '}
                  <Tooltip title="Changing the application resets the unsaved canvas.">
                    <InfoCircleOutlined />
                  </Tooltip>
                </span>
              )}
              rules={[{ required: true, message: 'Select an application' }]}
            >
              <Select
                showSearch
                loading={mappingsLoading}
                placeholder="Select an application"
                optionFilterProp="label"
                options={(mappings || []).map((mapping) => ({
                  value: mapping.id!,
                  label: mapping.appName || `Application ${mapping.id}`,
                }))}
                optionRender={(option) => {
                  const mapping = mappings?.find((item) => item.id === option.value);
                  return (
                    <div className={styles.applicationOption}>
                      <span>{option.label}</span>
                      <span className={styles.applicationOptionMeta}>
                        <Tag color="blue">{mapping?.env || '-'}</Tag>
                        <Tag>{mapping?.versionTag || '-'}</Tag>
                      </span>
                    </div>
                  );
                }}
              />
            </Form.Item>
            <Form.Item className={styles.environmentField} label="Environment">
              {selectedMapping?.env
                ? <Tag color="blue">{selectedMapping.env}</Tag>
                : <span className={styles.environmentPlaceholder}>Not selected</span>}
            </Form.Item>
            <Form.Item className={styles.environmentField} label="Version">
              {selectedMapping?.versionTag
                ? <Tag>{selectedMapping.versionTag}</Tag>
                : <span className={styles.environmentPlaceholder}>Not selected</span>}
            </Form.Item>
            <Form.Item className={styles.descriptionField} name="description" label="Description">
              <Input placeholder="What this flow verifies" />
            </Form.Item>
          </Form>
          {endpointsLoading && <div className={styles.loadingHint}>Loading endpoints…</div>}
        </div>
      )}
    />
  );
}
