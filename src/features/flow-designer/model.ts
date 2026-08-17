import type { Edge, Node, Viewport } from '@xyflow/react';
import type { BrickFlowEdge, BrickFlowNode, EndpointDefinition } from '@/types';

export interface HttpNodeData extends Record<string, unknown> {
  endpointId?: number;
  method: string;
  path: string;
  label: string;
  endpoint?: EndpointDefinition;
  flowNode: BrickFlowNode;
}

export type HttpCanvasNode = Node<HttpNodeData, 'http'>;

export interface FlowEdgeData extends Record<string, unknown> {
  flowEdge: BrickFlowEdge;
}

export type FlowCanvasEdge = Edge<FlowEdgeData>;

export interface FlowCanvasSavePayload {
  nodes: BrickFlowNode[];
  edges: BrickFlowEdge[];
  viewport: Viewport;
  sharedHeadersJson: string;
}
