/**
 * SSE streaming client for AI chat.
 * Uses XMLHttpRequest with onprogress — React Native's fetch doesn't
 * support ReadableStream, but XHR fires progress events as chunks arrive.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API_URL = __DEV__
  ? "http://localhost:8000"
  : "https://api.pebble.app";

type StreamCallbacks = {
  onDelta: (text: string) => void;
  onToolCall: (tool: string) => void;
  onDone: (conversationId: string) => void;
  onError: (message: string) => void;
};

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return sessionStorage.getItem("access_token");
  }
  return SecureStore.getItemAsync("access_token");
}

function parseSSEChunk(raw: string, callbacks: StreamCallbacks) {
  const events = raw.split("\n\n");
  for (const event of events) {
    const trimmed = event.trim();
    if (!trimmed.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(trimmed.slice(6));
      switch (data.type) {
        case "delta":
          callbacks.onDelta(data.content);
          break;
        case "tool_call":
          callbacks.onToolCall(data.tool);
          break;
        case "done":
          callbacks.onDone(data.conversation_id);
          break;
        case "error":
          callbacks.onError(data.message);
          break;
      }
    } catch {
      // Skip malformed JSON
    }
  }
}

export async function streamChat(
  message: string,
  conversationId: string | null,
  callbacks: StreamCallbacks,
): Promise<{ abort: () => void }> {
  const token = await getAccessToken();

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/v1/ai/chat`);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) {
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  }

  let lastIndex = 0;

  xhr.onprogress = () => {
    const newData = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    if (newData) {
      parseSSEChunk(newData, callbacks);
    }
  };

  xhr.onload = () => {
    // Process any remaining data not caught by onprogress
    const remaining = xhr.responseText.slice(lastIndex);
    if (remaining) {
      parseSSEChunk(remaining, callbacks);
    }

    if (xhr.status >= 400) {
      try {
        const err = JSON.parse(xhr.responseText);
        callbacks.onError(err.detail || `HTTP ${xhr.status}`);
      } catch {
        callbacks.onError(`HTTP ${xhr.status}`);
      }
    }
  };

  xhr.onerror = () => {
    callbacks.onError("Connection failed");
  };

  xhr.ontimeout = () => {
    callbacks.onError("Request timed out");
  };

  xhr.timeout = 120000; // 2 minutes for tool execution + streaming
  xhr.send(
    JSON.stringify({
      message,
      conversation_id: conversationId,
    })
  );

  return {
    abort: () => xhr.abort(),
  };
}
