import { create } from 'zustand';

export const useRaceBuilderStore = create((set, get) => ({
    startLine: null,
    checkpoints: [],
    setStartLine: (position) => set({ startLine: position }),
    addCheckpoint: (position) => set((state) => ({
      checkpoints: [...state.checkpoints, position]
    })),
    undoCheckpoint: () => set((state) => ({
      checkpoints: state.checkpoints.slice(0, -1)
    })),
    reset: () => set({ startLine: null, checkpoints: [] }),
  }));