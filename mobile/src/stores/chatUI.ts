import { create } from "zustand";

type ChatUIState = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
};

export const useChatUIStore = create<ChatUIState>((set) => ({
  open: false,
  openChat: () => set({ open: true }),
  closeChat: () => set({ open: false }),
}));
