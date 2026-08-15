'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Select, Input, Tag, Card, Space, Button, Drawer, Descriptions, Spin, Timeline } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import { useBrickStore } from '@/stores';

const STATUS_COLORS: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
  never_executed: 'default',
};

export default function RunsPage() {
  const { currentMapping } = useBrickStore();
  const [swaggerMappingId, setSwaggerMappingId] = useState<number | null>(null);
  const [flowName, setFlowName] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [runDetail, setRunDetail] = useState<Record<string, unknown> | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['runs', swaggerMappingId, flowName, status, pageNum, pageSize],
    queryFn: () => api.getRuns(swaggerMappingId!, { flowName, status, pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const handleSelectMapping = (id: number) => {
    setSwaggerMappingId(id);
    setPageNum(1);
  };

  const handleViewDetail = async (runId: number) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const detail = await api.getRunDetail(runId);
      setRunDetail(detail as Record<string, unknown>);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<Record<string, unknown>> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (v) => String(v) },
    { title: 'Flow ID', dataIndex: 'flowId', key: 'flowId', width: 80 },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => (
      <Tag color={STATUS_COLORS[s]} icon={s === 'running' ? <LoadingOutlined /> : s === 'success' ? <CheckCircleOutlined /> : s === 'failed' ? <CloseCircleOutlined /> : null}>
        {s}
      </Tag>
    )},
    { title: 'Triggered By', dataIndex: 'triggeredBy', key: 'triggeredBy' },
    { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', render: (v) => v ? `${v}ms` : '-' },
    { title: 'Started At', dataIndex: 'startTime', key: 'startTime' },
    { title: 'Ended At', dataIndex: 'endTime', key: 'endTime' },
    { title: 'Actions', key: 'action', width: 80, render: (_, record) => (
      <Button size="small" type="link" onClick={() => handleViewDetail(record.id as number)}>Details</Button>
    )},
  ];

  return (
    <div>
      <h2>Run History</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Select an application"
            style={{ width: 300 }}
            allowClear
            onChange={handleSelectMapping}
            value={swaggerMappingId}
          >
            {mappings?.map((m) => (
              <Select.Option key={m.id} value={m.id!}>
                {m.appName} - {m.env} - {m.versionTag}
              </Select.Option>
            ))}
          </Select>
          <Input.Search
            placeholder="Flow name"
            style={{ width: 200 }}
            onSearch={setFlowName}
          />
          <Select
            placeholder="Status"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={setStatus}
          >
            <Select.Option value="running">Running</Select.Option>
            <Select.Option value="success">Success</Select.Option>
            <Select.Option value="failed">Failed</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
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
          onChange: (p, ps) => { setPageNum(p); setPageSize(ps); },
        }}
      />

      <Drawer
        title="Run Details"
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setRunDetail(null); }}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
          </div>
        ) : runDetail ? (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Flow ID">{String(runDetail.flowId ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[runDetail.status as string]}>{runDetail.status as string}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Triggered By">{String(runDetail.triggeredBy ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="Duration">{runDetail.durationMs ? `${runDetail.durationMs}ms` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Started At">{String(runDetail.startTime ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="Ended At">{String(runDetail.endTime ?? '-')}</Descriptions.Item>
            </Descriptions>
            {runDetail.errorMsg && (
              <div style={{ marginTop: 16 }}>
                <h4>Error Details</h4>
                <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
                  {runDetail.errorMsg as string}
                </pre>
              </div>
            )}
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
