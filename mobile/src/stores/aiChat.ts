import { create } from "zustand";
import { apiRequest } from "../api/client";
import { streamChat } from "../api/streaming";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  last_message_preview: string | null;
};

type AIChatState = {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  activeToolCall: string | null;
  error: string | null;
  abortHandle: { abort: () => void } | null;

  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  startNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  stopStreaming: () => void;
};

let messageIdCounter = 0;
function tempId() {
  return `temp-${++messageIdCounter}`;
}

export const useAIChatStore = create<AIChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  activeToolCall: null,
  error: null,
  abortHandle: null,

  loadConversations: async () => {
    try {
      const data = await apiRequest<{ conversations: Conversation[] }>(
        "/v1/ai/conversations"
      );
      set({ conversations: data.conversations });
    } catch {
      // Silently fail — conversations list is non-critical
    }
  },

  loadConversation: async (id: string) => {
    try {
      const data = await apiRequest<{
        id: string;
        title: string | null;
        messages: { id: string; role: "user" | "assistant"; content: string }[];
      }>(`/v1/ai/conversations/${id}`);
      set({
        currentConversationId: id,
        messages: data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        error: null,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load conversation" });
    }
  },

  sendMessage: async (text: string) => {
    const { currentConversationId, isStreaming } = get();
    if (isStreaming) return;

    const userMsg: Message = { id: tempId(), role: "user", content: text };
    const assistantMsg: Message = {
      id: tempId(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    const assistantId = assistantMsg.id;

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      activeToolCall: null,
      error: null,
    }));

    const controller = await streamChat(
      text,
      currentConversationId,
      {
        onDelta: (content) => {
          set((state) => ({
            activeToolCall: null,
            messages: state.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + content }
                : m
            ),
          }));
        },
        onToolCall: (tool) => {
          set({ activeToolCall: tool });
        },
        onDone: (conversationId) => {
          set((state) => ({
            currentConversationId: conversationId,
            isStreaming: false,
            activeToolCall: null,
            abortHandle: null,
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m
            ),
          }));
          // Refresh conversations list in the background
          get().loadConversations();
        },
        onError: (message) => {
          set((state) => ({
            isStreaming: false,
            activeToolCall: null,
            abortHandle: null,
            error: message,
            // Remove empty assistant message on error
            messages: state.messages.filter(
              (m) => !(m.id === assistantId && m.content === "")
            ),
          }));
        },
      },
    );

    set({ abortHandle: controller });
  },

  startNewConversation: () => {
    const { abortHandle } = get();
    if (abortHandle) abortHandle.abort();
    set({
      currentConversationId: null,
      messages: [],
      isStreaming: false,
      activeToolCall: null,
      error: null,
      abortHandle: null,
    });
  },

  deleteConversation: async (id: string) => {
    try {
      await apiRequest(`/v1/ai/conversations/${id}`, { method: "DELETE" });
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        ...(state.currentConversationId === id
          ? { currentConversationId: null, messages: [] }
          : {}),
      }));
    } catch {
      // Silently fail
    }
  },

  stopStreaming: () => {
    const { abortHandle } = get();
    if (abortHandle) abortHandle.abort();
    set((state) => ({
      isStreaming: false,
      activeToolCall: null,
      abortHandle: null,
      messages: state.messages.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      ),
    }));
  },
}));
