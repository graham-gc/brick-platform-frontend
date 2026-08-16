import type {
  BrickFlowNode,
  EndpointDefinition,
  EndpointParameterDefinition,
  EndpointRequestDefinition,
} from '@/types';

export function parseRequestDefinition(endpoint?: EndpointDefinition): EndpointRequestDefinition {
  if (endpoint?.requestDefinitionJson) {
    try {
      return JSON.parse(endpoint.requestDefinitionJson) as EndpointRequestDefinition;
    } catch {
      // Fall through to path-based defaults for endpoints imported before request metadata existed.
    }
  }

  const pathParameters: EndpointParameterDefinition[] = [];
  const parameterPattern = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = parameterPattern.exec(endpoint?.endpointPath || '')) !== null) {
    pathParameters.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
      example: '',
    });
  }
  return { pathParameters, queryParameters: [], headers: [] };
}

function valuesForParameters(parameters: EndpointParameterDefinition[] | undefined) {
  return Object.fromEntries((parameters || []).map((parameter) => [
    parameter.name,
    parameter.example ?? '',
  ]));
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function createInitialNodeRequest(endpoint: EndpointDefinition): Partial<BrickFlowNode> {
  const definition = parseRequestDefinition(endpoint);
  const headers = valuesForParameters(definition.headers);
  if (definition.requestBody?.contentType && !Object.hasOwn(headers, 'Content-Type')) {
    headers['Content-Type'] = definition.requestBody.contentType;
  }

  return {
    headersJson: prettyJson(headers),
    queryParamsJson: prettyJson(valuesForParameters(definition.queryParameters)),
    pathVarsJson: prettyJson(valuesForParameters(definition.pathParameters)),
    payloadJson: definition.requestBody
      ? prettyJson(definition.requestBody.example ?? {})
      : undefined,
  };
}

export function prettyStoredJson(value: string | undefined, fallback: unknown) {
  if (!value?.trim()) return prettyJson(fallback);
  try {
    return prettyJson(JSON.parse(value));
  } catch {
    return value;
  }
}
