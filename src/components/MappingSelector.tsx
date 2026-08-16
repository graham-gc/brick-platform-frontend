'use client';

import { useMemo, useState } from 'react';
import { Select, Space } from 'antd';
import type { AppSwaggerMapping } from '@/types';

interface MappingSelectorProps {
  mappings?: AppSwaggerMapping[];
  loading?: boolean;
  value?: number | null;
  onChange: (mapping?: AppSwaggerMapping) => void;
}

export function MappingSelector({ mappings, loading, value, onChange }: MappingSelectorProps) {
  const [selectedAppConfigId, setSelectedAppConfigId] = useState<string>();
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>();

  const applicationOptions = useMemo(() => {
    const applications = new Map<string, string>();
    for (const mapping of mappings || []) {
      if (mapping.appConfigId && !applications.has(mapping.appConfigId)) {
        applications.set(mapping.appConfigId, mapping.appName || mapping.appConfigId);
      }
    }
    return Array.from(applications, ([optionValue, label]) => ({ value: optionValue, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [mappings]);

  const environmentOptions = useMemo(() => {
    const environments = new Set(
      (mappings || [])
        .filter((mapping) => mapping.appConfigId === selectedAppConfigId && mapping.env)
        .map((mapping) => mapping.env!)
    );
    return Array.from(environments).sort().map((optionValue) => ({ value: optionValue, label: optionValue }));
  }, [mappings, selectedAppConfigId]);

  const versionOptions = useMemo(() => (
    (mappings || [])
      .filter((mapping) => (
        mapping.appConfigId === selectedAppConfigId
        && mapping.env === selectedEnvironment
        && mapping.id != null
      ))
      .map((mapping) => ({ value: mapping.id!, label: mapping.versionTag || 'Unversioned' }))
      .sort((left, right) => left.label.localeCompare(right.label))
  ), [mappings, selectedAppConfigId, selectedEnvironment]);

  return (
    <div style={{ display: 'contents' }}>
      <Space orientation="vertical" size={4}>
        <span>Application</span>
        <Select
          placeholder="Select application"
          className="responsive-filter-control"
          style={{ width: '100%' }}
          options={applicationOptions}
          loading={loading}
          allowClear
          showSearch
          optionFilterProp="label"
          value={selectedAppConfigId}
          onChange={(appConfigId?: string) => {
            setSelectedAppConfigId(appConfigId);
            setSelectedEnvironment(undefined);
            onChange(undefined);
          }}
        />
      </Space>
      <Space orientation="vertical" size={4}>
        <span>Environment</span>
        <Select
          placeholder="Select environment"
          className="responsive-filter-control"
          style={{ width: '100%' }}
          options={environmentOptions}
          disabled={!selectedAppConfigId}
          allowClear
          value={selectedEnvironment}
          onChange={(environment?: string) => {
            setSelectedEnvironment(environment);
            onChange(undefined);
          }}
        />
      </Space>
      <Space orientation="vertical" size={4}>
        <span>Version</span>
        <Select
          placeholder="Select version"
          className="responsive-filter-control"
          style={{ width: '100%' }}
          options={versionOptions}
          disabled={!selectedEnvironment}
          allowClear
          value={value ?? undefined}
          onChange={(mappingId?: number) => {
            onChange((mappings || []).find((mapping) => mapping.id === mappingId));
          }}
        />
      </Space>
    </div>
  );
}
