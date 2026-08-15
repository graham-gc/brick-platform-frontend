import { create } from 'zustand';
import type { AppSwaggerMapping, BrickFlow, BrickFlowNode, BrickFlowEdge } from '@/types';

interface BrickState {
  // Currently selected mapping
  currentMapping: AppSwaggerMapping | null;
  setCurrentMapping: (mapping: AppSwaggerMapping | null) => void;

  // Flow designer state
  selectedFlow: BrickFlow | null;
  setSelectedFlow: (flow: BrickFlow | null) => void;

  flowNodes: BrickFlowNode[];
  setFlowNodes: (nodes: BrickFlowNode[]) => void;
  addFlowNode: (node: BrickFlowNode) => void;
  updateFlowNode: (id: number, node: Partial<BrickFlowNode>) => void;
  removeFlowNode: (id: number) => void;

  flowEdges: BrickFlowEdge[];
  setFlowEdges: (edges: BrickFlowEdge[]) => void;
  addFlowEdge: (edge: BrickFlowEdge) => void;
  removeFlowEdge: (id: number) => void;

  // Canvas viewport
  viewport: { x: number; y: number; zoom: number };
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // Active modal
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

export const useBrickStore = create<BrickState>((set) => ({
  currentMapping: null,
  setCurrentMapping: (mapping) => set({ currentMapping: mapping }),

  selectedFlow: null,
  setSelectedFlow: (flow) => set({ selectedFlow: flow }),

  flowNodes: [],
  setFlowNodes: (nodes) => set({ flowNodes: nodes }),
  addFlowNode: (node) => set((state) => ({ flowNodes: [...state.flowNodes, node] })),
  updateFlowNode: (id, updates) =>
    set((state) => ({
      flowNodes: state.flowNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeFlowNode: (id) =>
    set((state) => ({ flowNodes: state.flowNodes.filter((n) => n.id !== id) })),

  flowEdges: [],
  setFlowEdges: (edges) => set({ flowEdges: edges }),
  addFlowEdge: (edge) => set((state) => ({ flowEdges: [...state.flowEdges, edge] })),
  removeFlowEdge: (id) =>
    set((state) => ({ flowEdges: state.flowEdges.filter((e) => e.id !== id) })),

  viewport: { x: 0, y: 0, zoom: 1 },
  setViewport: (viewport) => set({ viewport }),

  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
}));
