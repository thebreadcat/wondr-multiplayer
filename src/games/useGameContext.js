import { create } from "zustand";

export const useGameContext = create((set, get) => ({
  localPlayerId: null,
  setLocalPlayerId: (id) => set({ localPlayerId: id }),
}));