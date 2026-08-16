'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Empty, Input, Result, Select, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { AppSwaggerMapping, EndpointDefinition, EndpointParameterDefinition } from '@/types';
import { useBrickStore } from '@/stores';
import { MappingSelector } from '@/components/MappingSelector';
import { parseRequestDefinition } from '@/features/flow-designer/request-definition';
import styles from './endpoints.module.css';

const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

export default function EndpointsPage() {
  const { setCurrentMapping } = useBrickStore();
  const [swaggerMappingId, setSwaggerMappingId] = useState<number | null>(null);
  const [method, setMethod] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEndpointId, setSelectedEndpointId] = useState<number>();

  const { data, isLoading } = useQuery({
    queryKey: ['endpoints', swaggerMappingId, method, keyword, pageNum, pageSize],
    queryFn: () => api.getEndpoints(swaggerMappingId!, { method, keyword, pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const { data: endpointDetail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['endpoint-detail', selectedEndpointId],
    queryFn: () => api.getEndpointDetail(selectedEndpointId!),
    enabled: selectedEndpointId != null,
  });

  const handleSelectMapping = (mapping?: AppSwaggerMapping) => {
    setCurrentMapping(mapping ?? null);
    setSwaggerMappingId(mapping?.id ?? null);
    setPageNum(1);
  };

  const columns: ColumnsType<EndpointDefinition> = [
    { title: 'ID', dataIndex: 'id', key: 'id', responsive: ['md'] },
    {
      title: 'Method',
      dataIndex: 'httpMethod',
      key: 'httpMethod',
      render: (method) => <Tag color={METHOD_COLORS[method] || 'default'}>{method}</Tag>,
    },
    {
      title: 'Path',
      dataIndex: 'endpointPath',
      key: 'endpointPath',
      render: (value) => <span className="responsive-table-text">{value}</span>,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      responsive: ['sm'],
      render: (value) => <span className="responsive-table-text">{value}</span>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      responsive: ['lg'],
      render: (value) => <span className="responsive-table-text">{value}</span>,
    },
    {
      title: 'Deprecated',
      dataIndex: 'deprecated',
      key: 'deprecated',
      responsive: ['md'],
      render: (v) => (v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value, endpoint) => (
        <Button
          type="link"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedEndpointId(endpoint.id);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const endpoint = endpointDetail?.endpoint;
  const requestDefinition = endpointDetail?.resolvedRequestDefinition
    || endpointDetail?.requestDefinition
    || (endpoint ? parseRequestDefinition(endpoint) : undefined);
  const parameters: EndpointParameterDefinition[] = requestDefinition ? [
    ...(requestDefinition.pathParameters || []),
    ...(requestDefinition.queryParameters || []),
    ...(requestDefinition.headers || []),
    ...(requestDefinition.cookieParameters || []),
    ...(requestDefinition.formParameters || []),
  ] : [];

  const parameterColumns: ColumnsType<EndpointParameterDefinition> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Location', dataIndex: 'in', key: 'in', render: (location) => <Tag>{location}</Tag> },
    { title: 'Type', key: 'type', render: (_value, parameter) => String(parameter.schema?.type || '-') },
    { title: 'Required', dataIndex: 'required', key: 'required', render: (required) => required ? <Tag color="red">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', responsive: ['md'] },
    { title: 'Example', key: 'example', responsive: ['lg'], render: (_value, parameter) => formatJson(parameter.example) },
  ];

  const detailTabs = endpoint ? [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Endpoint ID">{endpoint.id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Operation ID">{endpoint.operationId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Method"><Tag color={METHOD_COLORS[endpoint.httpMethod || '']}>{endpoint.httpMethod || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Deprecated">{endpoint.deprecated ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Protocol">{endpoint.protocol || '-'}</Descriptions.Item>
          <Descriptions.Item label="Host">{endpoint.host || '-'}</Descriptions.Item>
          <Descriptions.Item label="Base Path">{endpoint.basePath || '-'}</Descriptions.Item>
          <Descriptions.Item label="Swagger Version">{endpoint.swaggerVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="Full URL" span="filled">
            <Typography.Text copyable={!!endpoint.fullUrl}>{endpoint.fullUrl || '-'}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Summary" span="filled">{endpoint.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label="Description" span="filled">{endpoint.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tags">{endpoint.tags || '-'}</Descriptions.Item>
          <Descriptions.Item label="Consumes">{endpoint.consumesTypes || '-'}</Descriptions.Item>
          <Descriptions.Item label="Produces">{endpoint.producesTypes || '-'}</Descriptions.Item>
          <Descriptions.Item label="Environment">{endpoint.env || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'request',
      label: `Request (${parameters.length})`,
      children: (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {parameters.length ? (
            <Table
              columns={parameterColumns}
              dataSource={parameters}
              rowKey={(parameter) => `${parameter.in}-${parameter.name}`}
              pagination={false}
              tableLayout="auto"
            />
          ) : <Empty description="No request parameters are stored for this endpoint." />}
          {requestDefinition?.requestBody ? (
            <div className={styles.requestGrid}>
              <JsonPanel title="Request Body Schema" value={requestDefinition.requestBody.schema} />
              <JsonPanel title="Request Body Example" value={requestDefinition.requestBody.example} />
            </div>
          ) : <Empty description="No request body is stored for this endpoint." />}
        </Space>
      ),
    },
    {
      key: 'raw',
      label: 'Raw Definition',
      children: (
        <div className={styles.requestGrid}>
          <JsonPanel title="Stored Request Definition" value={endpointDetail?.requestDefinition || endpoint.requestDefinitionJson} />
          <JsonPanel title="Resolved Request Definition" value={endpointDetail?.resolvedRequestDefinition} />
        </div>
      ),
    },
  ] : [];

  return (
    <div>
      <h2>Endpoint Definitions</h2>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <MappingSelector
            mappings={mappings}
            loading={mappingsLoading}
            value={swaggerMappingId}
            onChange={handleSelectMapping}
          />
          <Space orientation="vertical" size={4}>
            <span>HTTP Method</span>
            <Select
              placeholder="All methods"
              className="responsive-filter-control"
              style={{ width: '100%' }}
              allowClear
              value={method}
              onChange={(value) => { setMethod(value); setPageNum(1); }}
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                <Select.Option key={m} value={m}>{m}</Select.Option>
              ))}
            </Select>
          </Space>
          <Space orientation="vertical" size={4}>
            <span>Endpoint</span>
            <Input.Search
              placeholder="Search path or summary"
              className="responsive-filter-control"
              style={{ width: '100%' }}
              onSearch={(v) => { setKeyword(v); setPageNum(1); }}
            />
          </Space>
        </div>
      </Card>

      <Table
        className="responsive-data-table"
        columns={columns}
        dataSource={data?.rows}
        rowKey="id"
        loading={isLoading}
        tableLayout="auto"
        locale={{
          emptyText: swaggerMappingId
            ? 'No endpoint definitions found'
            : 'Select an application, environment, and version to view endpoints',
        }}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `${total} endpoints`,
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
        rowClassName={(record) => record.id === selectedEndpointId ? `${styles.clickableRow} ${styles.selectedRow}` : styles.clickableRow}
        onRow={(record) => ({ onClick: () => setSelectedEndpointId(record.id) })}
      />

      <Drawer
        placement="bottom"
        size="78vh"
        open={selectedEndpointId != null}
        destroyOnHidden
        onClose={() => setSelectedEndpointId(undefined)}
        title={endpoint ? (
          <div className={styles.drawerTitle}>
            <Tag color={METHOD_COLORS[endpoint.httpMethod || '']}>{endpoint.httpMethod || '-'}</Tag>
            <span className={styles.drawerPath}>{endpoint.endpointPath || 'Endpoint Details'}</span>
          </div>
        ) : 'Endpoint Details'}
      >
        {detailLoading ? (
          <div style={{ display: 'grid', minHeight: 240, placeItems: 'center' }}><Spin size="large" /></div>
        ) : detailError ? (
          <Result status="error" title="Unable to load endpoint details" subTitle={detailError.message} />
        ) : endpoint ? (
          <Tabs items={detailTabs} />
        ) : null}
      </Drawer>
    </div>
  );
}

function formatJson(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className={styles.jsonPanel}>
      <div className={styles.jsonPanelTitle}>{title}</div>
      <pre>{formatJson(value)}</pre>
    </section>
  );
}
