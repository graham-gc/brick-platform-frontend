'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Input, Select, Tag, Space, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import type { EndpointDefinition } from '@/types';
import { useBrickStore } from '@/stores';

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

  const { data, isLoading } = useQuery({
    queryKey: ['endpoints', swaggerMappingId, method, keyword, pageNum, pageSize],
    queryFn: () => api.getEndpoints(swaggerMappingId!, { method, keyword, pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const handleSelectMapping = (id: number) => {
    const mapping = mappings?.find((m) => m.id === id);
    if (mapping) {
      setCurrentMapping(mapping);
      setSwaggerMappingId(id);
      setPageNum(1);
    }
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
  ];

  return (
    <div>
      <h2>Endpoint Definitions</h2>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap className="responsive-filter-bar">
          <Select
            placeholder="Select an application"
            className="responsive-filter-control"
            style={{ width: 300 }}
            onChange={handleSelectMapping}
            value={swaggerMappingId}
            allowClear
          >
            {mappings?.map((m) => (
              <Select.Option key={m.id} value={m.id!}>
                {m.appName} - {m.env} - {m.versionTag}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="HTTP method"
            className="responsive-filter-control"
            style={{ width: 120 }}
            allowClear
            value={method}
            onChange={setMethod}
          >
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
              <Select.Option key={m} value={m}>{m}</Select.Option>
            ))}
          </Select>
          <Input.Search
            placeholder="Search path or summary"
            className="responsive-filter-control"
            style={{ width: 200 }}
            onSearch={(v) => { setKeyword(v); setPageNum(1); }}
          />
        </Space>
      </Card>

      <Table
        className="responsive-data-table"
        columns={columns}
        dataSource={data?.rows}
        rowKey="id"
        loading={isLoading}
        tableLayout="auto"
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `${total} endpoints`,
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}
