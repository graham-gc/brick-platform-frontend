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
    { title: '流程ID', dataIndex: 'flowId', key: 'flowId', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => (
      <Tag color={STATUS_COLORS[s]} icon={s === 'running' ? <LoadingOutlined /> : s === 'success' ? <CheckCircleOutlined /> : s === 'failed' ? <CloseCircleOutlined /> : null}>
        {s}
      </Tag>
    )},
    { title: '触发人', dataIndex: 'triggeredBy', key: 'triggeredBy' },
    { title: '运行时长', dataIndex: 'durationMs', key: 'durationMs', render: (v) => v ? `${v}ms` : '-' },
    { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
    { title: '结束时间', dataIndex: 'endTime', key: 'endTime' },
    { title: '操作', key: 'action', width: 80, render: (_, record) => (
      <Button size="small" type="link" onClick={() => handleViewDetail(record.id as number)}>详情</Button>
    )},
  ];

  return (
    <div>
      <h2>执行历史</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择应用"
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
            placeholder="流程名称"
            style={{ width: 200 }}
            onSearch={setFlowName}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={setStatus}
          >
            <Select.Option value="running">运行中</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
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
        title="执行详情"
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
              <Descriptions.Item label="流程ID">{String(runDetail.flowId ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[runDetail.status as string]}>{runDetail.status as string}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发人">{String(runDetail.triggeredBy ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="运行时长">{runDetail.durationMs ? `${runDetail.durationMs}ms` : '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{String(runDetail.startTime ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{String(runDetail.endTime ?? '-')}</Descriptions.Item>
            </Descriptions>
            {runDetail.errorMsg && (
              <div style={{ marginTop: 16 }}>
                <h4>错误信息</h4>
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