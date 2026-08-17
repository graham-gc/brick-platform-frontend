import type { BrickFlowNode, EndpointResponseDefinition } from '@/types';

export interface FlowResponseVariable {
  name: string;
  responsePath: string;
  resultMode?: FlowResponseResultMode;
  selectorMode?: FlowResponseSelectorMode;
  fieldPath?: string;
  arrayIndex?: number;
  filterField?: string;
  filterOperator?: JsonPathFilterOperator;
  filterValue?: string;
}

export type FlowResponseResultMode = 'SINGLE' | 'FIRST' | 'LIST';
export type FlowResponseSelectorMode = 'DIRECT' | 'INDEX' | 'FILTER_FIRST' | 'ALL' | 'CUSTOM';
export type JsonPathFilterOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface FlowRequestVariableBinding {
  variableName: string;
  targetType: 'BODY' | 'QUERY' | 'PATH' | 'HEADER';
  targetPath: string;
  valueTemplate?: string;
}

export interface AvailableFlowVariable extends FlowResponseVariable {
  sourceNodeId: string;
  sourceNodeMethod: string;
  sourceNodePath: string;
}

export interface FieldTreeNode {
  title: string;
  value: string;
  key: string;
  children?: FieldTreeNode[];
}

export function parseResponseVariables(node: BrickFlowNode): FlowResponseVariable[] {
  return parseArray<FlowResponseVariable>(node.responseVariablesJson).map(hydrateResponseVariable);
}

export function parseRequestVariableBindings(node: BrickFlowNode): FlowRequestVariableBinding[] {
  return parseArray<FlowRequestVariableBinding>(node.requestVariableBindingsJson);
}

export function responseFieldTree(responses?: EndpointResponseDefinition[]): FieldTreeNode[] {
  const preferred = [...(responses || [])]
    .sort((left, right) => responsePriority(left.statusCode) - responsePriority(right.statusCode))[0];
  if (!preferred) return [];
  const schemaFields = preferred.schema ? schemaChildren(preferred.schema, '$') : [];
  return schemaFields.length ? schemaFields : valueChildren(preferred.example, '$');
}

export function requestBodyFieldTree(
  json?: string,
  schema?: Record<string, unknown>
): FieldTreeNode[] {
  let children: FieldTreeNode[] = [];
  if (json?.trim()) {
    try {
      children = valueChildren(JSON.parse(json), '$');
    } catch {
      // The form's JSON validator reports invalid content. Schema remains a useful field fallback.
    }
  }
  if (!children.length && schema) {
    children = schemaChildren(schema, '$');
  }
  return [{
    title: 'Entire request body',
    value: '$',
    key: '$',
    ...(children.length ? { children } : {}),
  }];
}

export function responseVariableExpression(variable: FlowResponseVariable): string {
  if (variable.selectorMode === 'CUSTOM') return variable.responsePath?.trim() || '';
  const fieldPath = variable.fieldPath?.trim() || variable.responsePath?.trim() || '';
  if (!fieldPath) return '';
  const array = firstArrayField(fieldPath);

  if (!array || variable.selectorMode === 'DIRECT' || !variable.selectorMode) return fieldPath;
  if (variable.selectorMode === 'INDEX') {
    const index = Number.isInteger(variable.arrayIndex) && (variable.arrayIndex ?? 0) >= 0
      ? variable.arrayIndex
      : 0;
    return `${array.arrayPath}[${index}]${array.itemSuffix}`;
  }
  if (variable.selectorMode === 'ALL') {
    return `${array.arrayPath}[*]${array.itemSuffix}`;
  }
  if (variable.selectorMode === 'FILTER_FIRST') {
    const filterField = variable.filterField?.trim();
    const filterValue = variable.filterValue?.trim();
    if (!filterField || filterValue == null || filterValue === '') return '';
    const operator = variable.filterOperator || '==';
    return `${array.arrayPath}[?(${jsonPathAccessor(filterField)} ${operator} ${jsonPathLiteral(filterValue)})]${array.itemSuffix}`;
  }
  return fieldPath;
}

export function prepareResponseVariablesForSave(
  variables?: FlowResponseVariable[]
): FlowResponseVariable[] {
  return (variables || []).map((variable) => {
    const responsePath = responseVariableExpression(variable);
    const resultMode: FlowResponseResultMode = variable.selectorMode === 'ALL'
      ? 'LIST'
      : variable.selectorMode === 'FILTER_FIRST'
        ? 'FIRST'
        : variable.selectorMode === 'CUSTOM'
          ? variable.resultMode || 'SINGLE'
          : 'SINGLE';
    return { ...variable, responsePath, resultMode };
  });
}

export function hasArraySelection(path?: string): boolean {
  return firstArrayField(path || '') != null;
}

export function arrayFilterFieldOptions(tree: FieldTreeNode[], fieldPath?: string) {
  const array = firstArrayField(fieldPath || '');
  if (!array) return [];
  const itemRoot = `${array.arrayPath}[0]`;
  return flattenFieldTree(tree)
    .filter((node) => !node.children?.length && node.value.startsWith(`${itemRoot}.`))
    .map((node) => {
      const value = node.value.substring(itemRoot.length + 1);
      return { value, label: value };
    });
}

export function isJsonPathShapeValid(path?: string): boolean {
  const value = path?.trim();
  if (!value?.startsWith('$')) return false;
  const closing: Record<string, string> = { ']': '[', ')': '(' };
  const stack: string[] = [];
  let quote = '';
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[' || character === '(') stack.push(character);
    if (character === ']' || character === ')') {
      if (stack.pop() !== closing[character]) return false;
    }
  }
  return !quote && stack.length === 0;
}

export function jsonObjectKeys(json?: string): string[] {
  if (!json?.trim()) return [];
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
  } catch {
    return [];
  }
}

function parseArray<T>(json?: string): T[] {
  if (!json?.trim()) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function hydrateResponseVariable(variable: FlowResponseVariable): FlowResponseVariable {
  if (variable.selectorMode) {
    return {
      ...variable,
      resultMode: variable.resultMode || selectorResultMode(variable.selectorMode),
    };
  }
  const responsePath = variable.responsePath || '';
  const wildcard = responsePath.match(/^(.*?)\[\*\](.*)$/);
  if (wildcard) {
    return {
      ...variable,
      selectorMode: 'ALL',
      fieldPath: `${wildcard[1]}[0]${wildcard[2]}`,
      resultMode: 'LIST',
    };
  }
  const index = responsePath.match(/^(.*?)\[(\d+)\](.*)$/);
  if (index) {
    return {
      ...variable,
      selectorMode: 'INDEX',
      fieldPath: `${index[1]}[0]${index[3]}`,
      arrayIndex: Number(index[2]),
      resultMode: variable.resultMode || 'SINGLE',
    };
  }
  if (responsePath.includes('[?(')) {
    return { ...variable, selectorMode: 'CUSTOM', resultMode: variable.resultMode || 'FIRST' };
  }
  return {
    ...variable,
    selectorMode: 'DIRECT',
    fieldPath: responsePath,
    resultMode: variable.resultMode || 'SINGLE',
  };
}

function selectorResultMode(mode: FlowResponseSelectorMode): FlowResponseResultMode {
  if (mode === 'ALL') return 'LIST';
  if (mode === 'FILTER_FIRST') return 'FIRST';
  return 'SINGLE';
}

function firstArrayField(path: string) {
  const match = path.match(/^(.*?)\[(?:\d+|\*)\](.*)$/);
  if (!match) return undefined;
  return { arrayPath: match[1], itemSuffix: match[2] };
}

function flattenFieldTree(tree: FieldTreeNode[]): FieldTreeNode[] {
  return tree.flatMap((node) => [node, ...flattenFieldTree(node.children || [])]);
}

function jsonPathAccessor(field: string) {
  return field.split('.').filter(Boolean).reduce((path, segment) => {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) return `${path}.${segment}`;
    return `${path}['${segment.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
  }, '@');
}

function jsonPathLiteral(value: string) {
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return value;
  if (value === 'true' || value === 'false' || value === 'null') return value;
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return JSON.stringify(value);
  }
}

function responsePriority(statusCode: string) {
  if (/^2\d\d$/.test(statusCode)) return Number(statusCode);
  if (statusCode === 'default') return 1000;
  return 2000 + Number(statusCode || 0);
}

function schemaChildren(schema: Record<string, unknown>, path: string): FieldTreeNode[] {
  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  if (properties) {
    return Object.entries(properties).map(([name, child]) => {
      const childSchema = isRecord(child) ? child : {};
      const childPath = `${path}.${name}`;
      const children = schemaChildren(childSchema, childPath);
      return {
        title: fieldTitle(name, childSchema.type),
        value: childPath,
        key: childPath,
        ...(children.length ? { children } : {}),
      };
    });
  }
  if (schema.type === 'array' && isRecord(schema.items)) {
    const itemPath = `${path}[0]`;
    const children = schemaChildren(schema.items, itemPath);
    return [{
      title: fieldTitle('[0]', schema.items.type),
      value: itemPath,
      key: itemPath,
      ...(children.length ? { children } : {}),
    }];
  }
  return [];
}

function valueChildren(value: unknown, path: string): FieldTreeNode[] {
  if (Array.isArray(value)) {
    if (!value.length) return [];
    const itemPath = `${path}[0]`;
    const children = valueChildren(value[0], itemPath);
    return [{ title: '[0]', value: itemPath, key: itemPath, ...(children.length ? { children } : {}) }];
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([name, child]) => {
    const childPath = `${path}.${name}`;
    const children = valueChildren(child, childPath);
    return {
      title: fieldTitle(name, Array.isArray(child) ? 'array' : typeof child),
      value: childPath,
      key: childPath,
      ...(children.length ? { children } : {}),
    };
  });
}

function fieldTitle(name: string, type: unknown) {
  return typeof type === 'string' && type ? `${name} · ${type}` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
