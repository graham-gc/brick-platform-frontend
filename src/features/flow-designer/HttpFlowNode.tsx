'use client';

import { memo } from 'react';
import { Button, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import {
  Handle,
  NodeToolbar,
  Position,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import type { FlowCanvasEdge, HttpCanvasNode } from './model';
import styles from './flow-designer.module.css';

const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

function HttpFlowNodeComponent({ id, data, selected }: NodeProps<HttpCanvasNode>) {
  const { deleteElements } = useReactFlow<HttpCanvasNode, FlowCanvasEdge>();

  return (
    <div className={`${styles.httpNode} ${selected ? styles.httpNodeSelected : ''}`}>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <Button
          className="nodrag"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => void deleteElements({ nodes: [{ id }] })}
        >
          Delete
        </Button>
      </NodeToolbar>

      <Handle id="input-top" className={styles.connectionHandle} type="source" position={Position.Top} />
      <Handle id="input-left" className={styles.connectionHandle} type="source" position={Position.Left} />

      <div className={styles.nodeHeader}>
        <Tag color={METHOD_COLORS[data.method] || 'default'}>{data.method || 'HTTP'}</Tag>
        <span className={styles.nodeId}>#{id}</span>
      </div>
      <div className={styles.nodePath} title={data.path}>{data.path}</div>
      {data.label && data.label !== data.path && (
        <div className={styles.nodeDescription} title={data.label}>{data.label}</div>
      )}
      <div className={styles.nodeHint}>Double-click to edit request</div>

      <Handle id="output-right" className={styles.connectionHandle} type="source" position={Position.Right} />
      <Handle id="output-bottom" className={styles.connectionHandle} type="source" position={Position.Bottom} />

    </div>
  );
}

export const HttpFlowNode = memo(HttpFlowNodeComponent);
