'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntdApp, Button, Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import * as api from '@/services/api';
import { FlowDesigner } from '@/features/flow-designer/FlowDesigner';
import { RunResultDrawer } from '@/features/run-result/RunResultDrawer';
import type { FlowCanvasSavePayload } from '@/features/flow-designer/model';

export default function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = AntdApp.useApp();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const flowId = Number(id);
  const [designerRevision, setDesignerRevision] = useState(0);
  const [resultRunId, setResultRunId] = useState<number>();

  const { data: flowDetail, isLoading: flowLoading, error: flowError } = useQuery({
    queryKey: ['flow-detail', flowId],
    queryFn: () => api.getFlowDetail(flowId),
    enabled: Number.isInteger(flowId) && flowId > 0,
  });

  const { data: endpoints, isLoading: endpointsLoading, error: endpointsError } = useQuery({
    queryKey: ['endpoints', flowDetail?.flow?.swaggerMappingId],
    queryFn: () => api.getAllEndpoints(flowDetail!.flow.swaggerMappingId!),
    enabled: !!flowDetail?.flow?.swaggerMappingId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FlowCanvasSavePayload) => {
      const flow = flowDetail!.flow;
      await api.updateFlow({
        flow: {
          ...flow,
          viewportX: payload.viewport.x,
          viewportY: payload.viewport.y,
          viewportZoom: payload.viewport.zoom,
          sharedHeadersJson: payload.sharedHeadersJson,
        },
        nodes: payload.nodes,
        edges: payload.edges,
        operator: 'admin',
      });
      return api.getFlowDetail(flowId);
    },
    onSuccess: (updatedDetail) => {
      queryClient.setQueryData(['flow-detail', flowId], updatedDetail);
      setDesignerRevision((revision) => revision + 1);
      message.success('Flow saved successfully');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: () => api.runFlow(flowId, 'admin'),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      if (run.id == null) {
        message.error('The backend completed the run without returning its ID');
        return;
      }
      setResultRunId(run.id);
      if (run.status === 'success') {
        message.success(`Flow completed in ${run.durationMs ?? 0} ms`);
      } else {
        message.warning('Flow completed with failures');
      }
    },
    onError: (error: Error) => message.error(error.message),
  });

  if (!Number.isInteger(flowId) || flowId <= 0) {
    return <div>Invalid flow ID</div>;
  }

  if (flowLoading || endpointsLoading) {
    return (
      <div style={{ display: 'grid', minHeight: '60vh', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const loadError = flowError || endpointsError;
  if (loadError) {
    return (
      <Result
        status="error"
        title="Unable to load the flow designer"
        subTitle={loadError.message}
        extra={<Button onClick={() => router.back()}>Back to flows</Button>}
      />
    );
  }

  if (!flowDetail?.flow) {
    return (
      <Result
        status="404"
        title="Flow not found"
        extra={<Button onClick={() => router.back()}>Back to flows</Button>}
      />
    );
  }

  return (
    <>
      <FlowDesigner
        key={`${flowId}-${designerRevision}`}
        flow={flowDetail.flow}
        persistedNodes={flowDetail.nodes || []}
        persistedEdges={flowDetail.edges || []}
        endpoints={endpoints || []}
        saving={saveMutation.isPending}
        running={runMutation.isPending}
        onBack={() => router.back()}
        onRun={() => runMutation.mutate()}
        onSave={(payload) => saveMutation.mutateAsync(payload).then(() => undefined)}
      />
      <RunResultDrawer
        open={resultRunId != null}
        runId={resultRunId}
        rerunning={runMutation.isPending}
        onClose={() => setResultRunId(undefined)}
        onRunAgain={() => runMutation.mutate()}
      />
    </>
  );
}
