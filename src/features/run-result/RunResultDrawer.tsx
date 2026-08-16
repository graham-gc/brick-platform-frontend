'use client';

import { useState, type Key } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
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
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import * as api from '@/services/api';
import type { BrickFlowRunNode } from '@/types';
import styles from './run-result-drawer.module.css';

const STATUS_COLORS: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
  blocked: 'warning',
  skipped: 'default',
};

interface RunResultDrawerProps {
  open: boolean;
  runId?: number;
  rerunning?: boolean;
  onClose: () => void;
  onRunAgain?: () => void;
}

function statusIcon(status?: string) {
  if (status === 'running') return <LoadingOutlined />;
  if (status === 'success') return <CheckCircleOutlined />;
  if (status === 'failed') return <CloseCircleOutlined />;
  return undefined;
}

function nodeRowKey(node: BrickFlowRunNode) {
  return node.id ?? `node-${node.nodeId ?? 'unknown'}`;
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

export function RunResultDrawer({
  open,
  runId,
  rerunning = false,
  onClose,
  onRunAgain,
}: RunResultDrawerProps) {
  const [selection, setSelection] = useState<{ runId?: number; nodeKey?: Key }>({});
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['run-detail', runId],
    queryFn: () => api.getRunDetail(runId!),
    enabled: open && runId != null,
  });

  const run = data?.run;
  const nodes = data?.nodes || [];
  const selectedNodeKey = selection.runId === runId ? selection.nodeKey : undefined;
  const selectedNode = nodes.find((node) => nodeRowKey(node) === selectedNodeKey)
    || nodes.find((node) => node.status === 'failed' || node.status === 'blocked')
    || nodes[0];
  const selectedNodeIndex = selectedNode
    ? nodes.findIndex((node) => nodeRowKey(node) === nodeRowKey(selectedNode))
    : -1;
  const successfulNodes = nodes.filter((node) => node.status === 'success').length;
  const failedNodes = nodes.filter((node) => node.status === 'failed' || node.status === 'blocked').length;

  const columns: ColumnsType<BrickFlowRunNode> = [
    {
      title: 'Step',
      key: 'step',
      width: 64,
      render: (_value, _node, index) => index + 1,
    },
    {
      title: 'Request',
      key: 'request',
      ellipsis: true,
      render: (_value, node) => (
        <div className={styles.requestCell}>
          <Tag color="blue">{node.requestMethod || '-'}</Tag>
          <Typography.Text title={node.requestUrl}>{node.requestUrl || `Node ${node.nodeId ?? '-'}`}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Result',
      dataIndex: 'status',
      key: 'status',
      width: 104,
      render: (status) => (
        <Tag color={STATUS_COLORS[status || '']} icon={statusIcon(status)}>{status || '-'}</Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 96,
      render: (duration) => duration == null ? '-' : `${duration} ms`,
    },
  ];

  const nodeTabs = selectedNode ? [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
          {selectedNode.errorMsg && (
            <Alert
              type={selectedNode.status === 'blocked' ? 'warning' : 'error'}
              showIcon
              title={selectedNode.status === 'blocked' ? 'Node execution blocked' : 'Node execution failed'}
              description={selectedNode.errorMsg}
            />
          )}
          <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="Node ID">{selectedNode.nodeId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Endpoint ID">{selectedNode.endpointId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLORS[selectedNode.status || '']}>{selectedNode.status || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="HTTP Status">{selectedNode.httpStatus ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Duration">
              {selectedNode.durationMs == null ? '-' : `${selectedNode.durationMs} ms`}
            </Descriptions.Item>
            <Descriptions.Item label="Response Size">
              {selectedNode.responseSize == null ? '-' : `${selectedNode.responseSize} bytes`}
            </Descriptions.Item>
            <Descriptions.Item label="Request URL" span="filled">
              <Typography.Text className={styles.requestUrl} copyable={!!selectedNode.requestUrl}>
                {selectedNode.requestUrl || '-'}
              </Typography.Text>
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
        <Descriptions bordered column={{ xs: 1, md: 3 }} size="small">
          <Descriptions.Item label="Total">{selectedNode.assertionTotalCount}</Descriptions.Item>
          <Descriptions.Item label="Passed">{selectedNode.assertionPassedCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Failed">{selectedNode.assertionFailedCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Summary" span="filled">{selectedNode.assertionSummary || '-'}</Descriptions.Item>
        </Descriptions>
      ) : <Empty description="No assertions were evaluated for this node." />,
    },
  ] : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="min(1180px, calc(100vw - 24px))"
      title={run ? (
        <Space wrap>
          <span>Run Result #{run.id}</span>
          <Tag color={STATUS_COLORS[run.status || '']} icon={statusIcon(run.status)}>{run.status || '-'}</Tag>
        </Space>
      ) : 'Run Result'}
      destroyOnHidden
      footer={(
        <div className={styles.drawerFooter}>
          <Button onClick={onClose}>Close</Button>
          <Space wrap>
            {run?.id && <Link href={`/runs/${run.id}`}><Button>View Full Details</Button></Link>}
            {onRunAgain && (
              <Button type="primary" icon={<ReloadOutlined />} loading={rerunning} onClick={onRunAgain}>
                Run Again
              </Button>
            )}
          </Space>
        </div>
      )}
    >
      {isLoading && <div className={styles.loading}><Spin size="large" /></div>}
      {error && (
        <Result
          status="error"
          title="Unable to load this run"
          subTitle={error.message}
          extra={<Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>Retry</Button>}
        />
      )}
      {run && (
        <>
          <div className={styles.metricGrid}>
            <Card size="small"><Statistic title="Duration" value={run.durationMs ?? 0} suffix="ms" /></Card>
            <Card size="small"><Statistic title="Successful Nodes" value={successfulNodes} suffix={`/ ${nodes.length}`} /></Card>
            <Card size="small"><Statistic title="Failed / Blocked" value={failedNodes} /></Card>
            <Card size="small"><Statistic title="Flow ID" value={run.flowId ?? '-'} /></Card>
          </div>
          {run.errorMsg && (
            <Alert
              className={styles.runAlert}
              type="error"
              showIcon
              title="Flow execution completed with failures"
              description={run.errorMsg}
            />
          )}
          <div className={styles.resultGrid}>
            <Card title={`Node Executions (${nodes.length})`} size="small" className={styles.nodeListCard}>
              <Table
                columns={columns}
                dataSource={nodes}
                rowKey={nodeRowKey}
                pagination={false}
                size="small"
                tableLayout="auto"
                scroll={{ y: 'calc(100vh - 370px)' }}
                locale={{ emptyText: 'No node execution records were created.' }}
                rowClassName={(node) => selectedNode && nodeRowKey(node) === nodeRowKey(selectedNode)
                  ? styles.selectedRow : ''}
                onRow={(node) => ({
                  onClick: () => setSelection({ runId, nodeKey: nodeRowKey(node) }),
                  style: { cursor: 'pointer' },
                })}
              />
            </Card>
            <Card
              title={selectedNode ? `Step ${selectedNodeIndex + 1} Details` : 'Node Details'}
              size="small"
              className={styles.nodeDetailCard}
              extra={selectedNode && <Tag color={STATUS_COLORS[selectedNode.status || '']}>{selectedNode.status || '-'}</Tag>}
            >
              {selectedNode ? <Tabs items={nodeTabs} /> : <Empty description="Select a node to inspect its result." />}
            </Card>
          </div>
        </>
      )}
    </Drawer>
  );
}
