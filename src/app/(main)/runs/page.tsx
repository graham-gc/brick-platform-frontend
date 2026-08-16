'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Select, Input, Tag, Card, Space, Button } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import * as api from '@/services/api';
import { MappingSelector } from '@/components/MappingSelector';

const STATUS_COLORS: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
  never_executed: 'default',
};

export default function RunsPage() {
  const [swaggerMappingId, setSwaggerMappingId] = useState<number | null>(null);
  const [flowName, setFlowName] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['runs', swaggerMappingId, flowName, status, pageNum, pageSize],
    queryFn: () => api.getRuns(swaggerMappingId!, { flowName, status, pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const columns: ColumnsType<Record<string, unknown>> = [
    { title: 'ID', dataIndex: 'id', key: 'id', responsive: ['md'], render: (v) => String(v) },
    { title: 'Flow ID', dataIndex: 'flowId', key: 'flowId', responsive: ['sm'] },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => (
      <Tag color={STATUS_COLORS[s]} icon={s === 'running' ? <LoadingOutlined /> : s === 'success' ? <CheckCircleOutlined /> : s === 'failed' ? <CloseCircleOutlined /> : null}>
        {s}
      </Tag>
    )},
    { title: 'Triggered By', dataIndex: 'triggeredBy', key: 'triggeredBy', responsive: ['lg'] },
    { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', responsive: ['md'], render: (v) => v ? `${v}ms` : '-' },
    { title: 'Started At', dataIndex: 'startTime', key: 'startTime', responsive: ['xl'] },
    { title: 'Ended At', dataIndex: 'endTime', key: 'endTime', responsive: ['xl'] },
    { title: 'Actions', key: 'action', render: (_, record) => (
      <Link href={`/runs/${record.id}`}>
        <Button size="small" type="link" icon={<EyeOutlined />}>Details</Button>
      </Link>
    )},
  ];

  return (
    <div>
      <h2>Run History</h2>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <MappingSelector
            mappings={mappings}
            loading={mappingsLoading}
            value={swaggerMappingId}
            onChange={(mapping) => {
              setSwaggerMappingId(mapping?.id ?? null);
              setPageNum(1);
            }}
          />
          <Space orientation="vertical" size={4}>
            <span>Flow</span>
            <Input.Search
              placeholder="Search flow name"
              className="responsive-filter-control"
              style={{ width: '100%' }}
              onSearch={setFlowName}
            />
          </Space>
          <Space orientation="vertical" size={4}>
            <span>Status</span>
            <Select
              placeholder="All statuses"
              className="responsive-filter-control"
              style={{ width: '100%' }}
              allowClear
              value={status}
              onChange={setStatus}
            >
              <Select.Option value="running">Running</Select.Option>
              <Select.Option value="success">Success</Select.Option>
              <Select.Option value="failed">Failed</Select.Option>
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} disabled={!swaggerMappingId} onClick={() => refetch()}>Refresh</Button>
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
            ? 'No run records found'
            : 'Select an application, environment, and version to view run history',
        }}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
      />

    </div>
  );
}
