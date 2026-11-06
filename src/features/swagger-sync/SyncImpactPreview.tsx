'use client';

import Link from 'next/link';
import { Alert, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SwaggerSyncImpact } from '@/types';

const columns: ColumnsType<SwaggerSyncImpact> = [
  {
    title: 'Flow / Node',
    key: 'flow',
    render: (_, impact) => {
      const tab = impact.referenceType === 'ASSERTION' ? 'assertions' : 'responseVariables';
      return (
        <Space orientation="vertical" size={2}>
          <Link
            href={{
              pathname: `/flows/${impact.flowId}`,
              query: { nodeId: impact.nodeId, tab },
            }}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the affected node in a new tab"
          >
            {impact.flowName || `Flow #${impact.flowId}`} · Node #{impact.nodeId}
          </Link>
          <Typography.Text type="secondary">
            {impact.httpMethod} {impact.endpointPath}
          </Typography.Text>
        </Space>
      );
    },
  },
  {
    title: 'Removed response field',
    key: 'field',
    render: (_, impact) => (
      <Space orientation="vertical" size={2}>
        <Typography.Text code>{impact.fieldPath}</Typography.Text>
        <Typography.Text type="secondary">
          Response {impact.statusCode}{impact.contentType ? ` · ${impact.contentType}` : ''}
        </Typography.Text>
      </Space>
    ),
  },
  {
    title: 'Referenced by',
    key: 'reference',
    render: (_, impact) => impact.referenceType === 'ASSERTION'
      ? 'JSONPath assertion'
      : `Response variable: ${impact.variableName}`,
  },
];

export function SyncImpactPreview({ impacts }: { impacts: SwaggerSyncImpact[] }) {
  const flowCount = new Set(impacts.map((impact) => impact.flowId)).size;
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type={impacts.length ? 'warning' : 'info'}
        showIcon
        title={impacts.length
          ? `Found ${impacts.length} affected field references in ${flowCount} ${flowCount === 1 ? 'flow' : 'flows'}`
          : 'No affected field references detected'}
        description={impacts.length
          ? 'The incoming document no longer declares these fields. Open a node in a new tab to review its configuration.'
          : 'The preview checks simple JSONPaths against comparable response schemas. It does not validate every workflow change.'}
      />
      {impacts.length > 0 && (
        <Table
          size="small"
          columns={columns}
          dataSource={impacts}
          rowKey={(impact) => JSON.stringify([
            impact.nodeId, impact.statusCode, impact.contentType, impact.fieldPath,
            impact.referenceType, impact.variableName, impact.assertionId,
          ])}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 620 }}
        />
      )}
    </Space>
  );
}
