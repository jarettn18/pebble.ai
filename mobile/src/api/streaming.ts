/**
 * SSE streaming client for AI chat.
 * Uses XMLHttpRequest with onprogress — React Native's fetch doesn't
 * support ReadableStream, but XHR fires progress events as chunks arrive.
 *
 * Set USE_MOCK = true to simulate AI responses without hitting the backend.
 */

import { getTokens, refreshAccessToken } from "./client";

/** Toggle this to skip real API calls during frontend development. */
const USE_MOCK = __DEV__ && false;

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
  const { access } = await getTokens();
  return access;
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

// ── Mock responses for frontend development ──────────────
type MockResponse = {
  tool?: string;
  text: string;
};

const MOCK_RESPONSES: Record<string, MockResponse> = {
  spending: {
    tool: "get_spending_by_category",
    text: "Here's your spending breakdown for this month:\n\n| Category | Amount | % of Total |\n|----------|--------|------------|\n| Food & Drink | **$482.30** | 28% |\n| Transportation | **$215.60** | 13% |\n| Shopping | **$189.45** | 11% |\n| Bills & Utilities | **$340.00** | 20% |\n| Entertainment | **$95.20** | 6% |\n| Other | **$372.45** | 22% |\n\nYour total spending is **$1,695.00** this month. Food & Drink is your largest category — that's about $16/day on average.",
  },
  budget: {
    tool: "get_budget_status",
    text: "Here's how you're tracking against your budgets this month:\n\n- **Food & Drink**: $482 of $600 (80%) — *$118 remaining*\n- **Transportation**: $216 of $250 (86%) — *$34 remaining*\n- **Shopping**: $189 of $200 (95%) — ⚠️ *Only $11 left*\n- **Entertainment**: $95 of $150 (63%) — *$55 remaining*\n\nOverall you've used **74%** of your total budget. Shopping is cutting it close — you might want to hold off on non-essential purchases for the rest of the month.",
  },
  merchants: {
    tool: "get_top_merchants",
    text: "Your top merchants this month:\n\n1. **Whole Foods** — $186.40 (8 transactions)\n2. **Shell Gas** — $142.30 (6 transactions)\n3. **Netflix** — $15.99 (1 transaction)\n4. **Starbucks** — $62.50 (14 transactions)\n5. **Amazon** — $127.85 (3 transactions)\n\nStarbucks has the most transactions — that's roughly **$4.46 per visit**. Your grocery spending at Whole Foods averages about $23 per trip.",
  },
  compare: {
    tool: "compare_spending",
    text: "Comparing this month to last month:\n\n| Category | Last Month | This Month | Change |\n|----------|-----------|------------|--------|\n| Food & Drink | $410.20 | $482.30 | 📈 +$72 (+18%) |\n| Transportation | $198.00 | $215.60 | 📈 +$18 (+9%) |\n| Shopping | $245.80 | $189.45 | 📉 -$56 (-23%) |\n| Entertainment | $120.00 | $95.20 | 📉 -$25 (-21%) |\n\nTotal spending is **up 5%** compared to last month. The increase is mainly driven by Food & Drink. On the bright side, you've cut back on Shopping significantly.",
  },
  income: {
    tool: "get_income_summary",
    text: "Your income this month:\n\n- **Salary**: $4,200.00\n- **Freelance**: $850.00\n- **Interest**: $12.40\n\n**Total income: $5,062.40**\n\nAfter your $1,695 in spending, you have a net surplus of **$3,367.40** this month. That's a solid 67% savings rate!",
  },
  fallback: {
    text: "I can help you understand your finances! Here are some things I can look up:\n\n- **Spending breakdowns** by category or merchant\n- **Budget tracking** — how you're doing vs. your targets\n- **Income summaries** and savings rates\n- **Spending comparisons** between time periods\n- **Recent transactions** with search and filters\n- **Account balances** and net worth\n\nWhat would you like to know?",
  },
};

function pickMockResponse(message: string): MockResponse {
  const lower = message.toLowerCase();
  if (lower.includes("spend") || lower.includes("categor"))
    return MOCK_RESPONSES.spending;
  if (lower.includes("budget") || lower.includes("track"))
    return MOCK_RESPONSES.budget;
  if (lower.includes("merchant") || lower.includes("top"))
    return MOCK_RESPONSES.merchants;
  if (lower.includes("compare") || lower.includes("last month"))
    return MOCK_RESPONSES.compare;
  if (lower.includes("income") || lower.includes("earn") || lower.includes("salar"))
    return MOCK_RESPONSES.income;
  return MOCK_RESPONSES.fallback;
}

let mockConversationCounter = 0;

async function streamChatMock(
  message: string,
  conversationId: string | null,
  callbacks: StreamCallbacks,
): Promise<{ abort: () => void }> {
  let aborted = false;
  const convId = conversationId ?? `mock-conv-${++mockConversationCounter}`;
  const mock = pickMockResponse(message);

  // Simulate tool call delay
  if (mock.tool) {
    await delay(300);
    if (aborted) return { abort: () => {} };
    callbacks.onToolCall(mock.tool);
    await delay(800);
    if (aborted) return { abort: () => {} };
  }

  // Stream text in chunks (simulates SSE deltas)
  const chunkSize = 12;
  for (let i = 0; i < mock.text.length; i += chunkSize) {
    if (aborted) break;
    callbacks.onDelta(mock.text.slice(i, i + chunkSize));
    await delay(25);
  }

  if (!aborted) {
    callbacks.onDone(convId);
  }

  return { abort: () => { aborted = true; } };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Real streaming implementation ─────────────────────────
export async function streamChat(
  message: string,
  conversationId: string | null,
  callbacks: StreamCallbacks,
): Promise<{ abort: () => void }> {
  if (USE_MOCK) {
    return streamChatMock(message, conversationId, callbacks);
  }

  // Ensure a fresh token — refresh proactively since XHR can't retry mid-stream
  let token = await getAccessToken();
  if (!token) {
    token = await refreshAccessToken();
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/v1/ai/chat`);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) {
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  }

  let lastIndex = 0;
  let retryAbort: (() => void) | null = null;

  xhr.onprogress = () => {
    const newData = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    if (newData) {
      parseSSEChunk(newData, callbacks);
    }
  };

  xhr.onload = async () => {
    // If 401, try refreshing and retrying once
    if (xhr.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry with fresh token
        const retryResult = await streamChat(message, conversationId, callbacks);
        retryAbort = retryResult.abort;
        return;
      }
    }

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
    abort: () => {
      xhr.abort();
      retryAbort?.();
    },
  };
}
