'use client';

import { useMemo, useState } from 'react';
import { Button, Empty, Input, Select, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { EndpointDefinition } from '@/types';
import styles from './flow-designer.module.css';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

interface EndpointPaletteProps {
  endpoints: EndpointDefinition[];
  onQuickAdd: (endpoint: EndpointDefinition) => void;
}

export function EndpointPalette({ endpoints, onQuickAdd }: EndpointPaletteProps) {
  const [keyword, setKeyword] = useState('');
  const [method, setMethod] = useState<string>();

  const filteredEndpoints = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return endpoints.filter((endpoint) => {
      const matchesMethod = !method || endpoint.httpMethod === method;
      const searchableText = [
        endpoint.endpointPath,
        endpoint.summary,
        endpoint.operationId,
        endpoint.tags,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesMethod && (!normalizedKeyword || searchableText.includes(normalizedKeyword));
    });
  }, [endpoints, keyword, method]);

  return (
    <aside className={styles.palette}>
      <div className={styles.paletteHeader}>
        <div>
          <div className={styles.paletteTitle}>Endpoint Library</div>
          <div className={styles.paletteCount}>{filteredEndpoints.length} endpoints</div>
        </div>
      </div>

      <div className={styles.paletteFilters}>
        <Input.Search
          allowClear
          placeholder="Search endpoints"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          allowClear
          placeholder="All methods"
          value={method}
          onChange={setMethod}
          options={METHODS.map((value) => ({ value, label: value }))}
        />
      </div>

      <div className={styles.endpointList}>
        {filteredEndpoints.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No endpoints found" />
        ) : filteredEndpoints.map((endpoint) => (
          <div
            className={styles.endpointItem}
            draggable
            key={endpoint.id}
            onDragStart={(event) => {
              event.dataTransfer.setData('application/brick-endpoint', String(endpoint.id));
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <div className={styles.endpointItemContent}>
              <div className={styles.endpointItemTitle}>
                <Tag color={METHOD_COLORS[endpoint.httpMethod || ''] || 'default'}>
                  {endpoint.httpMethod || 'HTTP'}
                </Tag>
                <span>{endpoint.summary || endpoint.operationId || 'Unnamed endpoint'}</span>
              </div>
              <div className={styles.endpointPath}>{endpoint.endpointPath}</div>
            </div>
            <Button
              className="nodrag"
              type="text"
              size="small"
              icon={<PlusOutlined />}
              title="Add to canvas"
              aria-label="Add to canvas"
              onClick={() => onQuickAdd(endpoint)}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
