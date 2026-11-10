'use client';

import Link from 'next/link';
import { Alert, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SwaggerSyncImpact, SwaggerSyncPreviewReport, SwaggerSyncUnassessedReference } from '@/types';

type ReferenceRow = SwaggerSyncImpact & {
  reason?: string;
  contractVersion?: SwaggerSyncUnassessedReference['contractVersion'];
};

const reasonText: Record<SwaggerSyncUnassessedReference['reason'], string> = {
  UNSUPPORTED_JSONPATH: 'This JSONPath uses syntax outside the preview’s supported scope.',
  OPERATION_MISSING: 'No matching endpoint with the same method and path.',
  RESPONSE_MISSING: 'No response with the same status and content type.',
  NO_DOCUMENTED_RESPONSE: 'No documented responses are available to compare.',
  SCHEMA_MISSING: 'No response schema is declared.',
  UNRESOLVED_SCHEMA: 'A schema reference could not be resolved.',
  COMPOSED_SCHEMA: 'The field path crosses a composed schema (such as allOf or oneOf).',
  UNSPECIFIED_SCHEMA_SHAPE: 'The schema does not describe the object or array needed to check this path.',
  PATH_NOT_DECLARED: 'None of the documented responses declare this path.',
};

const referenceColumns: ColumnsType<ReferenceRow> = [
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
            title="Open the node in a new tab"
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
    title: 'Response field',
    key: 'field',
    render: (_, impact) => (
      <Space orientation="vertical" size={2}>
        <Typography.Text code>{impact.fieldPath || '(No field path)'}</Typography.Text>
        {impact.statusCode && (
          <Typography.Text type="secondary">
            Response {impact.statusCode}{impact.contentType ? ` · ${impact.contentType}` : ''}
          </Typography.Text>
        )}
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

const unassessedColumns: ColumnsType<ReferenceRow> = [
  ...referenceColumns,
  {
    title: 'Reason',
    key: 'reason',
    render: (_, row) => (
      <Space orientation="vertical" size={2}>
        {row.contractVersion && (
          <Typography.Text type="secondary">
            {row.contractVersion === 'CURRENT' ? 'Current contract' : 'Incoming contract'}
          </Typography.Text>
        )}
        <Typography.Text>{row.reason}</Typography.Text>
      </Space>
    ),
  },
];

function referenceKey(row: ReferenceRow) {
  return JSON.stringify([
    row.nodeId, row.statusCode, row.contentType, row.fieldPath, row.referenceType,
    row.variableName, row.assertionId, row.reason, row.contractVersion,
  ]);
}

export function SyncImpactPreview({ report }: { report: SwaggerSyncPreviewReport }) {
  const { impacts, unassessed, checkedCount } = report;
  const hasImpact = impacts.length > 0;
  const incomplete = unassessed.length > 0;
  const title = incomplete
    ? (hasImpact ? 'Impact found; assessment incomplete' : 'Assessment incomplete')
    : hasImpact
      ? 'Affected field references detected'
      : checkedCount > 0
        ? 'No impact found in checked references'
        : 'No saved response references to check';
  const unassessedRows = unassessed.map(({ reference, reason, contractVersion }) => ({
    ...reference, reason: reasonText[reason], contractVersion,
  }));

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type={hasImpact || incomplete ? 'warning' : 'info'}
        showIcon
        title={title}
        description={(
          <Space orientation="vertical" size={4}>
            <span>
              Checked comparisons: {checkedCount} · Affected: {impacts.length} · Unable to assess: {unassessed.length}
            </span>
            <span>{incomplete
              ? 'Review the reasons below before deciding whether to sync.'
              : 'The preview checks removed response fields used by saved variables and enabled JSONPath assertions.'}</span>
          </Space>
        )}
      />
      {hasImpact && (
        <section aria-label="Affected references">
          <Typography.Title level={5}>Affected references</Typography.Title>
          <Table
            size="small"
            columns={referenceColumns}
            dataSource={impacts}
            rowKey={referenceKey}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 620 }}
          />
        </section>
      )}
      {incomplete && (
        <section aria-label="Unable to assess">
          <Typography.Title level={5}>Unable to assess</Typography.Title>
          <Table
            size="small"
            columns={unassessedColumns}
            dataSource={unassessedRows}
            rowKey={referenceKey}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
          />
        </section>
      )}
    </Space>
  );
}
