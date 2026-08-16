// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data: T;
}

// AppSwaggerMapping
export interface AppSwaggerMapping {
  id?: number;
  appName?: string;
  appConfigId?: string;
  realName?: string;
  swaggerUrl?: string;
  env?: string;
  active?: number;
  owner?: string;
  versionTag?: string;
  branchName?: string;
  isDeleted?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

// EndpointDefinition
export interface EndpointDefinition {
  id?: number;
  env?: string;
  swaggerMappingId?: number;
  appConfigId?: string;
  protocol?: string;
  host?: string;
  basePath?: string;
  endpointPath?: string;
  fullUrl?: string;
  httpMethod?: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string;
  deprecated?: number;
  swaggerVersion?: string;
  consumesTypes?: string;
  createsTypes?: string;
  producesTypes?: string;
  swaggerUrl?: string;
  docChecksum?: string;
  isLightweight?: number;
  requestDefinitionJson?: string;
  isDeleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface EndpointParameterDefinition {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface EndpointRequestBodyDefinition {
  required?: boolean;
  contentType?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface EndpointResponseDefinition {
  statusCode: string;
  description?: string;
  contentType?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface EndpointRequestDefinition {
  headers?: EndpointParameterDefinition[];
  queryParameters?: EndpointParameterDefinition[];
  pathParameters?: EndpointParameterDefinition[];
  cookieParameters?: EndpointParameterDefinition[];
  formParameters?: EndpointParameterDefinition[];
  requestBody?: EndpointRequestBodyDefinition;
  responses?: EndpointResponseDefinition[];
}

// BrickFlow
export interface BrickFlow {
  id?: number;
  name?: string;
  env?: string;
  swaggerMappingId?: number;
  appConfigId?: string;
  description?: string;
  status?: string;
  version?: number;
  sharedHeadersJson?: string;
  viewportX?: number;
  viewportY?: number;
  viewportZoom?: number;
  isDeleted?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

// BrickFlowNode
export interface BrickFlowNode {
  id?: number;
  flowId?: number;
  endpointId?: number;
  timeoutSec?: number;
  retries?: number;
  headersJson?: string;
  payloadJson?: string;
  queryParamsJson?: string;
  pathVarsJson?: string;
  responseVariablesJson?: string;
  requestVariableBindingsJson?: string;
  x?: number;
  y?: number;
  nodeType?: string;
  joinMode?: 'ALL' | 'ANY';
  isDeleted?: number;
}

// BrickFlowEdge
export interface BrickFlowEdge {
  id?: number;
  flowId?: number;
  sourceNodeId?: number;
  targetNodeId?: number;
  sourceHandle?: 'input-top' | 'input-left' | 'output-right' | 'output-bottom';
  targetHandle?: 'input-top' | 'input-left' | 'output-right' | 'output-bottom';
  edgeType?: string;
  conditionJson?: string;
  isDeleted?: number;
}

// BrickFlowRun
export interface BrickFlowRun {
  id?: number;
  flowId?: number;
  status?: string;
  triggeredBy?: string;
  runType?: number;
  durationMs?: number;
  errorMsg?: string;
  startTime?: string;
  endTime?: string;
  createTime?: string;
}

export interface BrickFlowRunNode {
  id?: number;
  runId?: number;
  nodeId?: number;
  endpointId?: number;
  status?: string;
  httpStatus?: number;
  durationMs?: number;
  startTime?: string;
  endTime?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: string;
  requestBody?: string;
  requestQueryParams?: string;
  requestPathParams?: string;
  responseHeaders?: string;
  responsePreview?: string;
  fullResponse?: string;
  responseSize?: number;
  errorMsg?: string;
  assertionTotalCount?: number;
  assertionPassedCount?: number;
  assertionFailedCount?: number;
  assertionSummary?: string;
}

// BrickTestSuite
export interface BrickTestSuite {
  id?: number;
  name?: string;
  env?: string;
  swaggerMappingId?: number;
  description?: string;
  isDeleted?: number;
  createBy?: string;
  createTime?: string;
}

// BrickGlobalVariable
export interface BrickGlobalVariable {
  id?: number;
  name?: string;
  type?: string;
  description?: string;
  config?: string;
  isEnabled?: number;
  category?: string;
  syntax?: string;
  dataType?: string;
  createBy?: string;
  createTime?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

// ValidateParseRequest
export interface ValidateParseRequest {
  swaggerUrl?: string;
  swaggerFileContent?: string;
  includeEndpoints?: boolean;
}

export interface ValidateParseResult {
  valid: boolean;
  type: string;
  swaggerContent?: string | null;
}

// SyncRequest
export interface SyncRequest {
  swaggerMappingId?: number;
  env: string;
  appConfigId?: string;
  appRealName?: string;
  versionTag: string;
  swaggerUrl?: string;
  swaggerContent: string;
  operator?: string;
  customHost?: string;
  customBasePath?: string;
}

export interface SyncResult {
  endpointCount: number;
  mappingId: number;
  versionTag?: string;
}

// FlowUpsertReq
export interface FlowUpsertReq {
  flow: BrickFlow;
  nodes: BrickFlowNode[];
  edges: BrickFlowEdge[];
  operator?: string;
}
