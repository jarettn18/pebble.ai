import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import Markdown from "react-native-marked";
import { colors, borderRadius, fonts, shadows } from "../../src/theme";
import {
  useAIChatStore,
  Message,
  Conversation,
} from "../../src/stores/aiChat";

// ── Suggested prompts for empty state ──────────────────────
const SUGGESTIONS = [
  "How much did I spend this month?",
  "Am I on track with my budgets?",
  "What are my top spending categories?",
  "Compare my spending to last month",
];

// ── Hoisted non-primitive props for memo stability ────────
const mdFlatListProps = {
  scrollEnabled: false,
  style: { backgroundColor: "transparent" },
};

const mdColorTheme = {
  colors: {
    text: colors.textPrimary,
    code: colors.surfaceContainer,
    link: colors.primary,
    border: colors.border,
  },
};

// ── Message bubble ─────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({
  message,
  activeToolCall,
}: {
  message: Message;
  activeToolCall: string | null;
}) {
  const isUser = message.role === "user";
  const showToolCall = message.isStreaming && message.content === "" && activeToolCall;
  const showLoader = message.isStreaming && message.content === "" && !activeToolCall;

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {isUser ? (
          <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
            {message.content}
          </Text>
        ) : (
          <Markdown
            value={message.content}
            flatListProps={mdFlatListProps}
            styles={mdTheme}
            theme={mdColorTheme}
          />
        )}
        {showToolCall ? <ToolCallPill tool={activeToolCall} /> : null}
        {showLoader ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </View>
    </View>
  );
});

// ── Tool call indicator ────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  get_spending_by_category: "Looking up spending...",
  get_spending_over_time: "Checking spending trends...",
  get_top_merchants: "Finding top merchants...",
  get_account_balances: "Checking account balances...",
  get_budget_status: "Checking budget status...",
  get_recent_transactions: "Looking up transactions...",
  get_income_summary: "Checking income...",
  compare_spending: "Comparing spending periods...",
};

const mdTheme: import("react-native-marked").MarkedStyles = {
  text: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  strong: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  em: {
    fontStyle: "italic",
    color: colors.textPrimary,
  },
  h1: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginTop: 6,
    marginBottom: 4,
  },
  h3: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 4,
  },
  li: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  codespan: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    color: colors.textPrimary,
  },
  code: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    padding: 12,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
  },
  link: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
};

const ToolCallPill = memo(function ToolCallPill({ tool }: { tool: string }) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.toolPill, { opacity: pulseAnim }]}>
      <MaterialCommunityIcons
        name="magnify"
        size={14}
        color={colors.primary}
      />
      <Text style={styles.toolPillText}>
        {TOOL_LABELS[tool] || "Looking up data..."}
      </Text>
    </Animated.View>
  );
});

// ── Conversation history item ──────────────────────────────
const ConversationItem = memo(function ConversationItem({
  conversation,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => onSelect(conversation.id)}
      activeOpacity={0.7}
    >
      <View style={styles.historyItemContent}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {conversation.title || "New conversation"}
        </Text>
        {conversation.last_message_preview && (
          <Text style={styles.historyPreview} numberOfLines={1}>
            {conversation.last_message_preview}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onDelete(conversation.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Delete conversation"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="delete-outline"
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ── Main screen ────────────────────────────────────────────
export default function AiChatScreen() {
  const {
    messages,
    isStreaming,
    activeToolCall,
    error,
    conversations,
    sendMessage,
    startNewConversation,
    loadConversations,
    loadConversation,
    deleteConversation,
  } = useAIChatStore();

  const [inputText, setInputText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const navigation = useNavigation();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Set up header buttons
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setShowHistory(true)}
          style={styles.headerBtn}
          accessibilityLabel="Conversation history"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="history"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={startNewConversation}
          style={styles.headerBtn}
          accessibilityLabel="New conversation"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="plus"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, startNewConversation]);

  const handleSend = useCallback(() => {
    const text = inputTextRef.current.trim();
    if (!text || isStreaming) return;
    setInputText("");
    sendMessage(text);
  }, [isStreaming, sendMessage]);

  const handleSuggestion = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage(text);
    },
    [isStreaming, sendMessage]
  );

  const handleSelectConversation = useCallback(
    (id: string) => {
      setShowHistory(false);
      loadConversation(id);
    },
    [loadConversation]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
    },
    [deleteConversation]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} activeToolCall={activeToolCall} />
    ),
    [activeToolCall]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const conversationKeyExtractor = useCallback((c: Conversation) => c.id, []);

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationItem
        conversation={item}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
      />
    ),
    [handleSelectConversation, handleDeleteConversation]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, messages[messages.length - 1]?.content.length]);

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={48}
            color={colors.primaryLight}
          />
          <Text style={styles.emptyTitle}>Pebble AI</Text>
          <Text style={styles.emptyHint}>
            Ask me anything about your finances
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionChip}
                onPress={() => handleSuggestion(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {error !== null ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your finances..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          editable={!isStreaming}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || isStreaming) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isStreaming}
          activeOpacity={0.7}
          accessibilityLabel={isStreaming ? "Stop response" : "Send message"}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={isStreaming ? "stop" : "send"}
            size={20}
            color={
              !inputText.trim() || isStreaming
                ? colors.textMuted
                : colors.textOnPrimary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Conversation history modal */}
      <Modal
        visible={showHistory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHistory(false)}
      >
        <Pressable
          style={styles.historyOverlay}
          onPress={() => setShowHistory(false)}
        >
          <Pressable
            style={styles.historySheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.historySheetTitle}>Conversations</Text>
            {conversations.length === 0 ? (
              <Text style={styles.historyEmpty}>No conversations yet</Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={conversationKeyExtractor}
                renderItem={renderConversation}
                style={styles.historyList}
              />
            )}
            <TouchableOpacity
              style={styles.historyCancelBtn}
              onPress={() => setShowHistory(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.historyCancelText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBtn: {
    paddingHorizontal: 12,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  suggestions: {
    marginTop: 32,
    width: "100%",
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...shadows.card,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleRow: {
    marginVertical: 4,
    flexDirection: "row",
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAssistant: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.textOnPrimary,
  },
  bubbleTextAssistant: {
    color: colors.textPrimary,
  },

  // Tool call pill
  toolPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  toolPillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primary,
  },

  // Error
  errorBar: {
    backgroundColor: colors.errorBackground,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.error,
    textAlign: "center",
  },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: colors.surface,
  },

  // History modal
  historyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  historySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  historySheetTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  historyEmpty: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
  historyList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyItemContent: {
    flex: 1,
    marginRight: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  historyPreview: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyCancelBtn: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 12,
  },
  historyCancelText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
});
