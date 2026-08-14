import type {
  AppSwaggerMapping,
  EndpointDefinition,
  BrickFlow,
  BrickFlowNode,
  BrickFlowEdge,
  BrickFlowRun,
  BrickTestSuite,
  BrickGlobalVariable,
  PaginatedResponse,
  ValidateParseRequest,
  SyncRequest,
  FlowUpsertReq,
} from '@/types';

const API_BASE = '/api/brick';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  const json = await res.json();
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(json.message || 'Request failed');
  }
  return json.data;
}

// ==================== Swagger Mapping APIs ====================

export const getMappings = (query?: Partial<AppSwaggerMapping>) => {
  const params = new URLSearchParams();
  if (query?.env) params.append('env', query.env);
  if (query?.appConfigId) params.append('appConfigId', query.appConfigId);
  if (query?.versionTag) params.append('versionTag', query.versionTag);
  return request<AppSwaggerMapping[]>(
    `${API_BASE}/mappings?${params.toString()}`
  );
};

export const getMappingById = (id: number) =>
  request<AppSwaggerMapping>(`${API_BASE}/mappings/${id}`);

export const createMapping = (data: AppSwaggerMapping) =>
  request<number>(`${API_BASE}/mappings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateMapping = (data: AppSwaggerMapping) =>
  request<number>(`${API_BASE}/mappings/update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteMapping = (id: number, operator?: string) => {
  const params = operator ? `?operator=${operator}` : '';
  return request<number>(`${API_BASE}/mappings/delete/${id}${params}`, {
    method: 'POST',
  });
};

export const getVersions = (env: string, appConfigId: string) =>
  request<AppSwaggerMapping[]>(
    `${API_BASE}/mappings/versions?env=${env}&appConfigId=${appConfigId}`
  );

// ==================== Swagger Sync APIs ====================

export const validateAndParse = (data: ValidateParseRequest) =>
  request<Record<string, unknown>>(`${API_BASE}/validate-and-parse`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const syncEndpoints = (data: SyncRequest) =>
  request<Record<string, unknown>>(`${API_BASE}/sync`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ==================== Endpoint APIs ====================

export const getEndpoints = (
  swaggerMappingId: number,
  options?: { method?: string; keyword?: string; pageNum?: number; pageSize?: number }
) => {
  const params = new URLSearchParams({ swaggerMappingId: String(swaggerMappingId) });
  if (options?.method) params.append('method', options.method);
  if (options?.keyword) params.append('keyword', options.keyword);
  if (options?.pageNum) params.append('pageNum', String(options.pageNum));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize || 10));
  return request<PaginatedResponse<EndpointDefinition>>(
    `${API_BASE}/endpoints?${params.toString()}`
  );
};

export const getAllEndpoints = (swaggerMappingId: number) =>
  request<EndpointDefinition[]>(
    `${API_BASE}/endpoints/all?swaggerMappingId=${swaggerMappingId}`
  );

export const getEndpointDetail = (id: number) =>
  request<Record<string, unknown>>(`${API_BASE}/endpoints/${id}`);

// ==================== Flow APIs ====================

export const getFlows = (
  query?: Partial<BrickFlow>,
  options?: { pageNum?: number; pageSize?: number; swaggerMappingId?: number }
) => {
  const params = new URLSearchParams();
  if (query?.env) params.append('env', query.env);
  if (options?.pageNum) params.append('pageNum', String(options.pageNum));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize || 10));
  if (options?.swaggerMappingId) params.append('swaggerMappingId', String(options.swaggerMappingId));
  return request<PaginatedResponse<BrickFlow>>(
    `${API_BASE}/flows?${params.toString()}`
  );
};

export const getFlowDetail = (id: number) =>
  request<{ flow: BrickFlow; nodes: BrickFlowNode[]; edges: BrickFlowEdge[] }>(
    `${API_BASE}/flows/${id}`
  );

export const createFlow = (data: FlowUpsertReq) =>
  request<BrickFlow>(`${API_BASE}/flows`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateFlow = (data: FlowUpsertReq) =>
  request<number>(`${API_BASE}/flows/update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteFlow = (id: number, operator?: string) => {
  const params = operator ? `?operator=${operator}` : '';
  return request<number>(`${API_BASE}/flows/delete/${id}${params}`, {
    method: 'POST',
  });
};

export const copyFlow = (flowId: number, newName: string, targetEnv?: string, operator?: string) =>
  request<{ sourceFlowId: number; newFlowId: number; newName: string }>(
    `${API_BASE}/flows/${flowId}/copy`,
    {
      method: 'POST',
      body: JSON.stringify({ newName, targetEnv, operator }),
    }
  );

// ==================== Flow Run APIs ====================

export const runFlow = (id: number, operator?: string, overrideBaseUrl?: string) =>
  request<BrickFlowRun>(`${API_BASE}/flows/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({ operator, overrideBaseUrl, runType: 0 }),
  });

export const getRunDetail = (runId: number) =>
  request<{ run: BrickFlowRun; nodes: BrickFlowRun[] }>(
    `${API_BASE}/flows/runs/${runId}`
  );

export const getRuns = (
  swaggerMappingId: number,
  options?: {
    flowId?: number;
    flowName?: string;
    status?: string;
    pageNum?: number;
    pageSize?: number;
  }
) => {
  const params = new URLSearchParams({ swaggerMappingId: String(swaggerMappingId) });
  if (options?.flowId) params.append('flowId', String(options.flowId));
  if (options?.flowName) params.append('flowName', options.flowName);
  if (options?.status) params.append('status', options.status);
  if (options?.pageNum) params.append('pageNum', String(options.pageNum));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize || 10));
  return request<PaginatedResponse<Record<string, unknown>>>(
    `${API_BASE}/flows/runs?${params.toString()}`
  );
};

// ==================== Test Suite APIs ====================

export const getTestSuites = (
  swaggerMappingId: number,
  options?: { keyword?: string; pageNum?: number; pageSize?: number }
) => {
  const params = new URLSearchParams({ swaggerMappingId: String(swaggerMappingId) });
  if (options?.keyword) params.append('keyword', options.keyword);
  if (options?.pageNum) params.append('pageNum', String(options.pageNum || 1));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize || 10));
  return request<PaginatedResponse<BrickTestSuite>>(
    `${API_BASE}/test-suites?${params.toString()}`
  );
};

export const getTestSuiteDetail = (id: number) =>
  request<{ suite: BrickTestSuite; flows: BrickFlow[] }>(
    `${API_BASE}/test-suites/${id}`
  );

export const createTestSuite = (suite: BrickTestSuite, flowMappings: unknown[], operator?: string) =>
  request<number>(`${API_BASE}/test-suites`, {
    method: 'POST',
    body: JSON.stringify({ suite, flowMappings, operator }),
  });

export const runTestSuite = (id: number, operator?: string) =>
  request<BrickFlowRun>(`${API_BASE}/test-suites/${id}/run?operator=${operator || ''}`, {
    method: 'POST',
  });

export const deleteTestSuite = (id: number) =>
  request<number>(`${API_BASE}/test-suites/delete/${id}`, {
    method: 'POST',
  });

// ==================== Global Variable APIs ====================

export const getGlobalVariables = (query?: Partial<BrickGlobalVariable>) => {
  const params = new URLSearchParams();
  if (query?.type) params.append('type', query.type);
  if (query?.category) params.append('category', query.category);
  return request<BrickGlobalVariable[]>(
    `${API_BASE}/global-variables?${params.toString()}`
  );
};

export const getGlobalVariableById = (id: number) =>
  request<BrickGlobalVariable>(`${API_BASE}/global-variables/${id}`);

export const createGlobalVariable = (variable: BrickGlobalVariable, operator: string) =>
  request<number>(`${API_BASE}/global-variables?operator=${operator}`, {
    method: 'POST',
    body: JSON.stringify({ variable }),
  });

export const updateGlobalVariable = (variable: BrickGlobalVariable, operator: string) =>
  request<number>(`${API_BASE}/global-variables/update`, {
    method: 'POST',
    body: JSON.stringify({ variable, operator }),
  });

export const deleteGlobalVariable = (id: number) =>
  request<number>(`${API_BASE}/global-variables/delete/${id}`, {
    method: 'POST',
  });