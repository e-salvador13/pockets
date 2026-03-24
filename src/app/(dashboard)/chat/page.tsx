'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowUp,
  DollarSign,
  Mic,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { InlineChart, parseChartBlocks, type ChartSpec } from '@/components/charts/inline-chart';
import {
  getUser,
  getTransactions,
  getMonthlySnapshot,
  getCategoryBreakdown,
  detectRecurringCharges,
  addMessageToConversation,
  getCurrentConversation,
  startNewConversation,
  type ChatMessage,
} from '@/lib/store';

/* ─────────────── Page ─────────────── */
export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [snapshot, setSnapshot] = useState({ earned: 0, spent: 0, flexible: 0 });
  const [hasData, setHasData] = useState(false);
  const [userName, setUserName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load state on mount
  useEffect(() => {
    const user = getUser();
    const transactions = getTransactions();
    const snap = getMonthlySnapshot();
    const convo = getCurrentConversation();

    setUserName(user.name);
    setSnapshot(snap);
    setHasData(transactions.length > 0);
    setMessages(convo.messages);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    addMessageToConversation(userMsg);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const user = getUser();
      const snap = getMonthlySnapshot();
      const breakdown = getCategoryBreakdown();
      const recurring = detectRecurringCharges();
      const transactions = getTransactions();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            user: {
              name: user.name,
              personality: user.personality,
              primaryGoal: user.primaryGoal,
              checkingFloor: user.checkingFloor,
              monthlyInvest: user.monthlyInvest,
              takeHomeIncome: user.takeHomeIncome,
            },
            snapshot: snap,
            categoryBreakdown: breakdown,
            recurring: recurring.map((r) => ({
              description: r.description,
              amount: r.amount,
              frequency: r.frequency,
            })),
            transactionCount: transactions.length,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n').filter((l) => l.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                if (json.content) {
                  fullContent += json.content;
                  setStreamingContent(fullContent);
                }
              } catch {
                // skip
              }
            }
          }
        }
      }

      // Save completed message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent || 'I apologize, but I had trouble generating a response. Please try again.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      addMessageToConversation(assistantMsg);
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I couldn't connect to the AI service. Make sure Ollama is running (\`ollama serve\`) with the llama3 model available.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      addMessageToConversation(errorMsg);
      setStreamingContent('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    startNewConversation();
    setMessages([]);
    setStreamingContent('');
  };

  const suggestions = hasData
    ? [
        'How much did I spend on food this month?',
        'Can I afford a $200 dinner this weekend?',
        'Show me my spending by category as a chart',
        'What are my recurring subscriptions?',
        'How much can I invest this month?',
      ]
    : [
        'What can you help me with?',
        'How do I import my bank data?',
        'Tell me about my financial goals',
      ];

  return (
    <div className="flex h-dvh flex-col" style={{ background: '#0A0A0F' }}>
      {/* Header with snapshot */}
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: '#2A2A3A' }}
      >
        <button onClick={handleNewChat} className="rounded-xl p-2 transition-colors hover:opacity-80" style={{ background: '#1A1A24' }}>
          <Plus className="h-4 w-4" style={{ color: '#8888A0' }} />
        </button>

        {hasData ? (
          <div className="flex items-center gap-4">
            <SnapshotPill
              icon={TrendingUp}
              label="Earned"
              value={snapshot.earned}
              color="#4ADE80"
            />
            <SnapshotPill
              icon={TrendingDown}
              label="Spent"
              value={snapshot.spent}
              color="#F87171"
            />
            <SnapshotPill
              icon={Wallet}
              label="Flexible"
              value={snapshot.flexible}
              color="#D4A853"
            />
          </div>
        ) : (
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
            CashPilot
          </h1>
        )}

        <div className="w-8" /> {/* spacer */}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !streamingContent ? (
          <EmptyState
            userName={userName}
            suggestions={suggestions}
            onSuggestionClick={sendMessage}
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streamingContent && (
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed"
                  style={{ background: '#1A1A24', color: '#E0E0E8' }}
                >
                  <RichContent content={streamingContent} />
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse" style={{ background: '#4ADE80' }} />
                </div>
              </div>
            )}
            {isLoading && !streamingContent && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="border-t px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3"
        style={{ borderColor: '#2A2A3A', background: 'rgba(10,10,15,0.8)' }}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          {/* Mic button placeholder */}
          <button
            type="button"
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{ background: '#1A1A24' }}
          >
            <Mic className="h-4 w-4" style={{ color: '#555570' }} />
          </button>

          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="w-full resize-none rounded-2xl border px-4 py-3 pr-12 text-sm leading-relaxed placeholder:opacity-40 focus:outline-none"
              style={{
                background: '#1A1A24',
                borderColor: '#2A2A3A',
                color: '#FFFFFF',
                maxHeight: '120px',
              }}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="mb-1 h-10 w-10 shrink-0 rounded-xl transition-all disabled:opacity-20"
            style={{
              background: input.trim() ? '#4ADE80' : '#1A1A24',
              color: input.trim() ? '#0A0A0F' : '#555570',
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ──────────── Sub Components ──────────── */

function SnapshotPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#8888A0' }}>
        {label}
      </span>
      <span className="text-xs font-semibold" style={{ color }}>
        ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}

function EmptyState({
  userName,
  suggestions,
  onSuggestionClick,
}: {
  userName: string;
  suggestions: string[];
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
      >
        <DollarSign className="h-6 w-6" style={{ color: '#4ADE80' }} />
      </div>

      <h2 className="mb-2 text-xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        {userName ? `Hey, ${userName}` : 'CashPilot'}
      </h2>
      <p className="mb-10 text-sm" style={{ color: '#8888A0' }}>
        Ask me anything about your finances.
      </p>

      <div className="flex w-full max-w-sm flex-col gap-2.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-2xl border px-5 py-3.5 text-left text-sm transition-all duration-200 hover:scale-[1.01]"
            style={{
              borderColor: '#2A2A3A',
              background: 'rgba(26,26,36,0.3)',
              color: '#8888A0',
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed`}
        style={{
          background: isUser ? '#4ADE80' : '#1A1A24',
          color: isUser ? '#0A0A0F' : '#E0E0E8',
        }}
      >
        {isUser ? message.content : <RichContent content={message.content} />}
      </div>
    </div>
  );
}

/**
 * Renders text with inline charts parsed from ```chart blocks.
 */
function RichContent({ content }: { content: string }) {
  const { parts } = parseChartBlocks(content);

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
              {part}
            </span>
          );
        }
        // It's a ChartSpec
        return <InlineChart key={i} spec={part as ChartSpec} />;
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1.5 rounded-2xl px-5 py-4"
        style={{ background: '#1A1A24' }}
      >
        <div
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: '#8888A0' }}
        />
        <div
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: '#8888A0', animationDelay: '150ms' }}
        />
        <div
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: '#8888A0', animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
