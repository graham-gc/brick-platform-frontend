'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Input, Select, Tag, Space, Button, Card } from 'antd';
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
  const { currentMapping, setCurrentMapping } = useBrickStore();
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
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '方法',
      dataIndex: 'httpMethod',
      key: 'httpMethod',
      width: 80,
      render: (method) => <Tag color={METHOD_COLORS[method] || 'default'}>{method}</Tag>,
    },
    { title: '路径', dataIndex: 'endpointPath', key: 'endpointPath', ellipsis: true },
    { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: '标签', dataIndex: 'tags', key: 'tags', ellipsis: true },
    {
      title: '废弃',
      dataIndex: 'deprecated',
      key: 'deprecated',
      width: 60,
      render: (v) => (v ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
    },
  ];

  return (
    <div>
      <h2>接口定义</h2>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择应用"
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
            placeholder="HTTP方法"
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
            placeholder="搜索路径/摘要"
            style={{ width: 200 }}
            onSearch={(v) => { setKeyword(v); setPageNum(1); }}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.rows}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}