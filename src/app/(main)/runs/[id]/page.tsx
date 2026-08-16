'use client';

import { use, useState } from 'react';
import type { Key } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Result,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PartitionOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import * as api from '@/services/api';
import type { BrickFlowRunNode } from '@/types';
import styles from './run-detail.module.css';

const STATUS_COLORS: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
};

function statusIcon(status?: string) {
  if (status === 'running') return <LoadingOutlined />;
  if (status === 'success') return <CheckCircleOutlined />;
  if (status === 'failed') return <CloseCircleOutlined />;
  return undefined;
}

function formatPayload(value?: string) {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function CodePanel({ title, value }: { title: string; value?: string }) {
  return (
    <section className={styles.codePanel}>
      <div className={styles.codePanelTitle}>{title}</div>
      <pre>{formatPayload(value)}</pre>
    </section>
  );
}

function nodeRowKey(node: BrickFlowRunNode) {
  return node.id ?? `node-${node.nodeId ?? 'unknown'}`;
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const runId = Number(id);
  const [selectedNodeKey, setSelectedNodeKey] = useState<Key>();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['run-detail', runId],
    queryFn: () => api.getRunDetail(runId),
    enabled: Number.isInteger(runId) && runId > 0,
  });

  if (!Number.isInteger(runId) || runId <= 0) {
    return <Result status="error" title="Invalid run ID" extra={<Link href="/runs"><Button>Back to Run History</Button></Link>} />;
  }

  if (isLoading) {
    return <div style={{ display: 'grid', minHeight: '60vh', placeItems: 'center' }}><Spin size="large" /></div>;
  }

  if (error || !data?.run) {
    return (
      <Result
        status="error"
        title="Unable to load this run"
        subTitle={error instanceof Error ? error.message : 'The execution record does not exist.'}
        extra={<Link href="/runs"><Button>Back to Run History</Button></Link>}
      />
    );
  }

  const run = data.run;
  const nodes = data.nodes || [];
  const selectedNode = nodes.find((node) => nodeRowKey(node) === selectedNodeKey) || nodes[0];
  const selectedNodeIndex = selectedNode ? nodes.findIndex((node) => nodeRowKey(node) === nodeRowKey(selectedNode)) : -1;
  const successCount = nodes.filter((node) => node.status === 'success').length;
  const failedCount = nodes.filter((node) => node.status === 'failed').length;

  const columns: ColumnsType<BrickFlowRunNode> = [
    {
      title: 'Step',
      key: 'sequence',
      width: 72,
      render: (_value, _record, index) => index + 1,
    },
    {
      title: 'Request',
      key: 'request',
      ellipsis: true,
      render: (_value, node) => (
        <Space size={8}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{node.requestMethod || '-'}</Tag>
          <Typography.Text title={node.requestUrl}>{node.requestUrl || '-'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'HTTP Status',
      dataIndex: 'httpStatus',
      key: 'httpStatus',
      render: (httpStatus) => (
        <Tag color={httpStatus >= 200 && httpStatus < 400 ? 'green' : httpStatus ? 'red' : 'default'}>
          {httpStatus ?? '-'}
        </Tag>
      ),
    },
    {
      title: 'Result',
      dataIndex: 'status',
      key: 'status',
      render: (nodeStatus) => (
        <Tag color={STATUS_COLORS[nodeStatus || '']} icon={statusIcon(nodeStatus)}>{nodeStatus || '-'}</Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (duration) => duration == null ? '-' : `${duration} ms`,
    },
    { title: 'Started At', dataIndex: 'startTime', key: 'startTime', responsive: ['lg'] },
  ];

  const nodeTabs = selectedNode ? [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {selectedNode.errorMsg && <Alert type="error" showIcon title="Node execution failed" description={selectedNode.errorMsg} />}
          <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Node ID">{selectedNode.nodeId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Endpoint ID">{selectedNode.endpointId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLORS[selectedNode.status || '']} icon={statusIcon(selectedNode.status)}>{selectedNode.status || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="HTTP Method">{selectedNode.requestMethod || '-'}</Descriptions.Item>
            <Descriptions.Item label="HTTP Status">{selectedNode.httpStatus ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Duration">{selectedNode.durationMs == null ? '-' : `${selectedNode.durationMs} ms`}</Descriptions.Item>
            <Descriptions.Item label="Started At">{selectedNode.startTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="Ended At">{selectedNode.endTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="Response Size">{selectedNode.responseSize == null ? '-' : `${selectedNode.responseSize} bytes`}</Descriptions.Item>
            <Descriptions.Item label="Request URL" span="filled">
              <Typography.Text className={styles.requestUrl} copyable={!!selectedNode.requestUrl}>{selectedNode.requestUrl || '-'}</Typography.Text>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      ),
    },
    {
      key: 'request',
      label: 'Request',
      children: (
        <div className={styles.codeGrid}>
          <CodePanel title="Headers" value={selectedNode.requestHeaders} />
          <CodePanel title="Query Parameters" value={selectedNode.requestQueryParams} />
          <CodePanel title="Path Parameters" value={selectedNode.requestPathParams} />
          <CodePanel title="Body" value={selectedNode.requestBody} />
        </div>
      ),
    },
    {
      key: 'response',
      label: 'Response',
      children: (
        <div className={styles.codeGrid}>
          <CodePanel title="Response Headers" value={selectedNode.responseHeaders} />
          <CodePanel title="Response Body" value={selectedNode.fullResponse} />
        </div>
      ),
    },
    {
      key: 'assertions',
      label: `Assertions (${selectedNode.assertionTotalCount ?? 0})`,
      children: selectedNode.assertionTotalCount ? (
        <Descriptions bordered column={{ xs: 1, sm: 3 }}>
          <Descriptions.Item label="Total">{selectedNode.assertionTotalCount}</Descriptions.Item>
          <Descriptions.Item label="Passed">{selectedNode.assertionPassedCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Failed">{selectedNode.assertionFailedCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Summary" span="filled">{selectedNode.assertionSummary || '-'}</Descriptions.Item>
        </Descriptions>
      ) : (
        <div className={styles.assertionPlaceholder}>
          <Empty description="No assertions were evaluated for this node." />
        </div>
      ),
    },
  ] : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Space align="start">
          <Link href="/runs"><Button icon={<ArrowLeftOutlined />}>Back</Button></Link>
          <div>
            <Typography.Title level={2} className={styles.headerTitle}>Run #{run.id}</Typography.Title>
            <Typography.Text type="secondary">Flow #{run.flowId}</Typography.Text>
          </div>
        </Space>
        <Space wrap>
          {run.flowId && <Link href={`/flows/${run.flowId}`}><Button icon={<PartitionOutlined />}>Open Flow</Button></Link>}
          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>Refresh</Button>
        </Space>
      </header>

      <div className={styles.metricGrid}>
        <Card><Statistic title="Run Status" value={run.status || '-'} prefix={statusIcon(run.status)} /></Card>
        <Card><Statistic title="Duration" value={run.durationMs ?? 0} suffix="ms" /></Card>
        <Card><Statistic title="Successful Nodes" value={successCount} suffix={`/ ${nodes.length}`} /></Card>
        <Card><Statistic title="Failed Nodes" value={failedCount} /></Card>
      </div>

      <Card title="Execution Summary" className={styles.summaryCard}>
        {run.errorMsg && <Alert type="error" showIcon title="Flow execution failed" description={run.errorMsg} style={{ marginBottom: 16 }} />}
        <Descriptions bordered column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Run ID">{run.id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Flow ID">{run.flowId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Triggered By">{run.triggeredBy || '-'}</Descriptions.Item>
          <Descriptions.Item label="Run Type">{run.runType ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Started At">{run.startTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ended At">{run.endTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="Duration">{run.durationMs == null ? '-' : `${run.durationMs} ms`}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={STATUS_COLORS[run.status || '']} icon={statusIcon(run.status)}>{run.status || '-'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`Node Executions (${nodes.length})`} className={styles.nodesCard}>
        <Table
          className="responsive-data-table"
          columns={columns}
          dataSource={nodes}
          rowKey={nodeRowKey}
          pagination={false}
          tableLayout="auto"
          locale={{ emptyText: 'No node execution records were created.' }}
          rowClassName={(node) => selectedNode && nodeRowKey(node) === nodeRowKey(selectedNode) ? styles.selectedRow : ''}
          onRow={(node) => ({
            onClick: () => setSelectedNodeKey(nodeRowKey(node)),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {selectedNode && (
        <Card
          title={`Step ${selectedNodeIndex + 1} Details`}
          className={styles.detailCard}
          extra={<Tag color={STATUS_COLORS[selectedNode.status || '']}>{selectedNode.status || '-'}</Tag>}
        >
          <Tabs items={nodeTabs} />
        </Card>
      )}
    </div>
  );
}
