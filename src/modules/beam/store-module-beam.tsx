import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { DLLMId } from '~/modules/llms/store-llms';


/// Presets (persistes as zustand store) ///

interface BeamScatterPreset {
  id: string;
  name: string;
  rayLlmIds: DLLMId[];
}


interface ModuleBeamStore {
  // state
  scatterPresets: BeamScatterPreset[];
  cardScrolling: boolean;
  gatherShowDevMethods: boolean;
  gatherShowPrompts: boolean;

  // actions
  addScatterPreset: (name: string, rayLlmIds: DLLMId[]) => void;
  deleteScatterPreset: (id: string) => void;
  renameScatterPreset: (id: string, name: string) => void;

  toggleCardScrolling: () => void;

  toggleGatherShowDevMethods: () => void;
  toggleGatherShowPrompts: () => void;
}


export const useModuleBeamStore = create<ModuleBeamStore>()(persist(
  (_set, _get) => ({

    scatterPresets: [],
    cardScrolling: false,
    gatherShowDevMethods: true,
    gatherShowPrompts: false,


    addScatterPreset: (name, rayLlmIds) => _set(state => ({
      scatterPresets: [...state.scatterPresets, { id: uuidv4(), name, rayLlmIds }],
    })),

    deleteScatterPreset: (id) => _set(state => ({
      scatterPresets: state.scatterPresets.filter(preset => preset.id !== id),
    })),

    renameScatterPreset: (id, name) => _set(state => ({
      scatterPresets: state.scatterPresets.map(preset => preset.id === id ? { ...preset, name } : preset),
    })),


    toggleCardScrolling: () => _set(state => ({ cardScrolling: !state.cardScrolling })),


    toggleGatherShowDevMethods: () => _set(state => ({ gatherShowDevMethods: !state.gatherShowDevMethods })),

    toggleGatherShowPrompts: () => _set(state => ({ gatherShowPrompts: !state.gatherShowPrompts })),

  }), {
    name: 'app-module-beam',
  },
));


export function getBeamCardScrolling() {
  return useModuleBeamStore.getState().cardScrolling;
}

export function useBeamCardScrolling() {
  return useModuleBeamStore((state) => state.cardScrolling);
}
