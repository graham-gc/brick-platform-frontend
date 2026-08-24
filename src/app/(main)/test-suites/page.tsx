'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antd';
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '@/services/api';
import { MappingSelector } from '@/components/MappingSelector';
import { BUSINESS_STATUS_COLORS, businessStatusLabel } from '@/features/run-result/status';
import type {
  AppSwaggerMapping,
  BrickFlow,
  BrickTestSuite,
  BrickTestSuiteFlowMapping,
  BrickTestSuiteFlowRun,
} from '@/types';

const REQUEST_STATUS_COLORS: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
};

interface SuiteFormValues {
  name: string;
  description?: string;
  flowIds: number[];
}

export default function TestSuitesPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<SuiteFormValues>();
  const [selectedMapping, setSelectedMapping] = useState<AppSwaggerMapping>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<BrickTestSuite>();
  const [suiteDetailId, setSuiteDetailId] = useState<number>();
  const [runDetailId, setRunDetailId] = useState<number>();
  const selectedFlowIds = Form.useWatch('flowIds', form) || [];

  const swaggerMappingId = selectedMapping?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['test-suites', swaggerMappingId, pageNum, pageSize],
    queryFn: () => api.getTestSuites(swaggerMappingId!, { pageNum, pageSize }),
    enabled: !!swaggerMappingId,
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api.getMappings(),
  });

  const { data: availableFlows, isLoading: flowsLoading } = useQuery({
    queryKey: ['test-suite-flows', swaggerMappingId],
    queryFn: () => api.getFlows(undefined, { swaggerMappingId, pageNum: 1, pageSize: 500 }),
    enabled: !!swaggerMappingId,
  });

  const { data: suiteDetail, isLoading: suiteDetailLoading } = useQuery({
    queryKey: ['test-suite-detail', suiteDetailId],
    queryFn: () => api.getTestSuiteDetail(suiteDetailId!),
    enabled: !!suiteDetailId,
  });

  const { data: runDetail, isLoading: runDetailLoading } = useQuery({
    queryKey: ['test-suite-run-detail', runDetailId],
    queryFn: () => api.getTestSuiteRunDetail(runDetailId!),
    enabled: !!runDetailId,
  });

  const saveMutation = useMutation({
    mutationFn: (values: SuiteFormValues) => {
      const suite: BrickTestSuite = {
        ...editingSuite,
        name: values.name,
        description: values.description,
        swaggerMappingId,
        env: selectedMapping?.env,
        appConfigId: selectedMapping?.appConfigId,
      };
      const flowMappings: BrickTestSuiteFlowMapping[] = values.flowIds.map((flowId, index) => ({
        flowId,
        executionOrder: index + 1,
      }));
      return editingSuite?.id
        ? api.updateTestSuite(suite, flowMappings, 'graham')
        : api.createTestSuite(suite, flowMappings, 'graham');
    },
    onSuccess: () => {
      message.success(editingSuite ? 'Test suite updated' : 'Test suite created');
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      setEditorOpen(false);
      setEditingSuite(undefined);
      form.resetFields();
    },
    onError: (error: Error) => message.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTestSuite(id),
    onSuccess: () => {
      message.success('Test suite deleted');
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => api.runTestSuite(id, 'graham'),
    onSuccess: (run) => {
      message.success('Test suite execution completed');
      queryClient.invalidateQueries({ queryKey: ['test-suite-runs'] });
      if (run.id) setRunDetailId(run.id);
    },
    onError: (error: Error) => message.error(error.message),
  });

  const rerunMutation = useMutation({
    mutationFn: (runId: number) => api.rerunFailedTestSuiteFlows(runId, 'graham'),
    onSuccess: (run) => {
      message.success('Failed flows were rerun');
      if (run.id) setRunDetailId(run.id);
    },
    onError: (error: Error) => message.error(error.message),
  });

  const openCreate = () => {
    setEditingSuite(undefined);
    form.resetFields();
    setEditorOpen(true);
  };

  const openEdit = async (suite: BrickTestSuite) => {
    if (!suite.id) return;
    try {
      const detail = await api.getTestSuiteDetail(suite.id);
      setEditingSuite(suite);
      form.setFieldsValue({
        name: suite.name || '',
        description: suite.description,
        flowIds: detail.flows.map((flow) => flow.id!).filter(Boolean),
      });
      setEditorOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to load the test suite');
    }
  };

  const moveSelectedFlow = (index: number, offset: number) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= selectedFlowIds.length) return;
    const reordered = [...selectedFlowIds];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    form.setFieldValue('flowIds', reordered);
  };

  const columns: ColumnsType<BrickTestSuite> = [
    {
      title: 'Test Suite',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setSuiteDetailId(record.id)}>
          {value}
        </Button>
      ),
    },
    { title: 'Environment', dataIndex: 'env', key: 'env', responsive: ['sm'], render: (env) => <Tag color="blue">{env}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', responsive: ['md'] },
    { title: 'Created At', dataIndex: 'createTime', key: 'createTime', responsive: ['lg'] },
    {
      title: 'Actions',
      key: 'action',
      render: (_, record) => (
        <div className="responsive-table-actions">
          <Button
            size="small"
            type="link"
            icon={<PlayCircleOutlined />}
            loading={runMutation.isPending && runMutation.variables === record.id}
            onClick={() => runMutation.mutate(record.id!)}
          >
            <span className="responsive-action-label">Run</span>
          </Button>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => setSuiteDetailId(record.id)}>
            <span className="responsive-action-label">View</span>
          </Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            <span className="responsive-action-label">Edit</span>
          </Button>
          <Popconfirm title="Delete this test suite?" onConfirm={() => deleteMutation.mutate(record.id!)}>
            <Button size="small" danger type="link" icon={<DeleteOutlined />}>
              <span className="responsive-action-label">Delete</span>
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const flowRunColumns: ColumnsType<BrickTestSuiteFlowRun> = [
    { title: 'Flow', dataIndex: 'flowName', key: 'flowName' },
    {
      title: 'Request Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={REQUEST_STATUS_COLORS[status] || 'default'}>{status || 'unknown'}</Tag>,
    },
    {
      title: 'Business Result',
      dataIndex: 'businessStatus',
      key: 'businessStatus',
      render: (status) => (
        <Tag color={BUSINESS_STATUS_COLORS[status || 'not_evaluated']}>
          {businessStatusLabel(status)}
        </Tag>
      ),
    },
    { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', responsive: ['sm'], render: (value) => value == null ? '-' : `${value} ms` },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => <Link href={`/runs/${record.id}`}>View run</Link>,
    },
  ];

  const hasRerunnableFailures = runDetail?.flowRuns.some(
    (run) => run.status !== 'success' || run.businessStatus === 'failed'
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h2>Test Suites</h2>
        <Button type="primary" icon={<PlusOutlined />} disabled={!swaggerMappingId} onClick={openCreate}>
          New Test Suite
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <MappingSelector
            mappings={mappings}
            loading={mappingsLoading}
            value={swaggerMappingId}
            onChange={(mapping) => {
              setSelectedMapping(mapping);
              setPageNum(1);
            }}
          />
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
            ? 'No test suites found'
            : 'Select an application, environment, and version to view test suites',
        }}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          },
        }}
      />

      <Modal
        title={editingSuite ? 'Edit Test Suite' : 'New Test Suite'}
        open={editorOpen}
        width={720}
        onCancel={() => {
          setEditorOpen(false);
          setEditingSuite(undefined);
          form.resetFields();
        }}
        onOk={() => form.validateFields().then((values) => saveMutation.mutate(values))}
        confirmLoading={saveMutation.isPending}
      >
        <Alert
          type="info"
          showIcon
          title="Flows run in the order shown below. Use the arrow buttons to change execution order."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Test Suite Name" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="Checkout regression" />
          </Form.Item>
          <Form.Item
            name="flowIds"
            label="Flows"
            rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one flow' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select flows in execution order"
              loading={flowsLoading}
              options={(availableFlows?.rows || []).map((flow) => ({ value: flow.id!, label: flow.name || `Flow ${flow.id}` }))}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
          {selectedFlowIds.length > 0 && (
            <Card size="small" title="Execution Order" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {selectedFlowIds.map((flowId: number, index: number) => {
                  const flow = availableFlows?.rows.find((item) => item.id === flowId);
                  return (
                    <div
                      key={flowId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                      <span>{index + 1}. {flow?.name || `Flow ${flowId}`}</span>
                      <Space size={4}>
                        <Button
                          type="text"
                          size="small"
                          aria-label={`Move ${flow?.name || `Flow ${flowId}`} up`}
                          icon={<UpOutlined />}
                          disabled={index === 0}
                          onClick={() => moveSelectedFlow(index, -1)}
                        />
                        <Button
                          type="text"
                          size="small"
                          aria-label={`Move ${flow?.name || `Flow ${flowId}`} down`}
                          icon={<DownOutlined />}
                          disabled={index === selectedFlowIds.length - 1}
                          onClick={() => moveSelectedFlow(index, 1)}
                        />
                      </Space>
                    </div>
                  );
                })}
              </Space>
            </Card>
          )}
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="What this suite validates" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={suiteDetail?.suite.name || 'Test Suite Details'}
        open={!!suiteDetailId}
        size="min(760px, 94vw)"
        loading={suiteDetailLoading}
        onClose={() => setSuiteDetailId(undefined)}
      >
        {suiteDetail && (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Environment">{suiteDetail.suite.env || '-'}</Descriptions.Item>
              <Descriptions.Item label="Flow Count">{suiteDetail.flows.length}</Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>{suiteDetail.suite.description || '-'}</Descriptions.Item>
            </Descriptions>
            <Table<BrickFlow>
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={suiteDetail.flows}
              columns={[
                { title: '#', key: 'order', width: 56, render: (_, __, index) => index + 1 },
                { title: 'Flow', dataIndex: 'name', key: 'name' },
                { title: 'Description', dataIndex: 'description', key: 'description', responsive: ['md'] },
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Drawer
        title={runDetail?.suite ? `${runDetail.suite.name} — Execution Result` : 'Test Suite Execution Result'}
        open={!!runDetailId}
        size="min(1100px, 96vw)"
        loading={runDetailLoading}
        extra={hasRerunnableFailures ? (
          <Button
            icon={<RedoOutlined />}
            loading={rerunMutation.isPending}
            onClick={() => rerunMutation.mutate(runDetailId!)}
          >
            Rerun Failed Flows
          </Button>
        ) : null}
        onClose={() => setRunDetailId(undefined)}
      >
        {runDetail && (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Card size="small"><Statistic title="Total Flows" value={runDetail.suiteRun.totalFlows || 0} /></Card>
              <Card size="small"><Statistic title="Request Success" value={runDetail.suiteRun.successFlows || 0} valueStyle={{ color: '#389e0d' }} /></Card>
              <Card size="small"><Statistic title="Request Failed" value={runDetail.suiteRun.failedFlows || 0} valueStyle={{ color: '#cf1322' }} /></Card>
              <Card size="small"><Statistic title="Business Passed" value={runDetail.suiteRun.businessPassedFlows || 0} valueStyle={{ color: '#389e0d' }} /></Card>
              <Card size="small"><Statistic title="Business Failed" value={runDetail.suiteRun.businessFailedFlows || 0} valueStyle={{ color: '#cf1322' }} /></Card>
              <Card size="small"><Statistic title="Duration" value={runDetail.suiteRun.durationMs || 0} suffix="ms" /></Card>
            </div>
            {runDetail.suiteRun.errorMsg && <Alert type="error" showIcon title={runDetail.suiteRun.errorMsg} />}
            <Table
              className="responsive-data-table"
              rowKey="id"
              tableLayout="auto"
              pagination={false}
              dataSource={runDetail.flowRuns}
              columns={flowRunColumns}
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
}
