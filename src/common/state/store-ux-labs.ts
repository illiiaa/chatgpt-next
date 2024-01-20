import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// UX Labs Experiments

/**
 * Graduated:
 *  - Persona YT Creator: still under a 'true' flag, to disable it if needed
 *  - Text Tools: dinamically shown where applicable
 *  - Chat Mode: follow-ups; moved to Chat Advanced UI, itemized (Auto-title, Auto-diagram)
 */
interface UXLabsStore {

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsEnhancedUI: boolean;
  setLabsEnhancedUI: (labsEnhancedUI: boolean) => void;

  labsSplitBranching: boolean;
  setLabsSplitBranching: (labsSplitBranching: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsCameraDesktop: false,
      setLabsCameraDesktop: (labsCameraDesktop: boolean) => set({ labsCameraDesktop }),

      labsEnhancedUI: false,
      setLabsEnhancedUI: (labsEnhancedUI: boolean) => set({ labsEnhancedUI }),

      labsSplitBranching: false,
      setLabsSplitBranching: (labsSplitBranching: boolean) => set({ labsSplitBranching }),

    }),
    {
      name: 'app-ux-labs',
    },
  ),
);