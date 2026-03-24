'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowUp, Upload, Loader2, Check, Sparkles } from 'lucide-react';
import { parseCSV } from '@/lib/import/csv-parser';
import { categorize } from '@/lib/import/categorizer';
import {
  setUser,
  addTransactions,
  generateBudgets,
  setBudgets,
  type Transaction,
} from '@/lib/store';

/* ─────────────── Types ─────────────── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'upload-prompt' | 'plan';
  plan?: BudgetPlan;
}

interface BudgetPlan {
  archetype: string;
  monthlyIncome: number;
  costToBeYou: number;
  categories: {
    needs: { name: string; amount: number }[];
    wants: { name: string; amount: number }[];
    goals: { name: string; amount: number }[];
  };
  insight: string;
  recommendation: string;
}

interface TransactionSummary {
  totalTransactions: number;
  months: number;
  topCategories: { category: string; total: number; percentage: number }[];
  totalIncome: number;
  totalSpent: number;
  monthlyAvgSpent: number;
  surprisingInsight?: string;
}

/* ─────────────── Constants ─────────────── */

const OPENING_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hey, I'm Pockets. Before we set anything up, I'm curious — what's going on with your money right now? No wrong answers.",
  timestamp: new Date(),
  type: 'text',
};

/* ─────────────── Page ─────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turn, setTurn] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadedData, setUploadedData] = useState<TransactionSummary | null>(null);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Hide welcome after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Focus input
  useEffect(() => {
    if (!isLoading && !plan) {
      inputRef.current?.focus();
    }
  }, [isLoading, plan]);

  /* ─── Send message ─── */
  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: messageText,
        timestamp: new Date(),
        type: 'text',
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');
      setIsLoading(true);

      try {
        // Build conversation history for API
        const history = updatedMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            turn,
            transactionSummary: uploadedData,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to get response');
        }

        const data = await res.json();

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          type: data.plan ? 'plan' : 'text',
          plan: data.plan || undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setTurn(data.turn);

        // Show upload prompt after turn 3 (if no data yet)
        if (data.turn >= 4 && !uploadedData) {
          setShowUpload(true);
        }

        // If plan was returned, save it
        if (data.plan) {
          setPlan(data.plan);
        }
      } catch (error) {
        console.error('Send error:', error);
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            "Sorry, I had trouble processing that. Make sure the server is running and ANTHROPIC_API_KEY is set.",
          timestamp: new Date(),
          type: 'text',
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, turn, uploadedData]
  );

  /* ─── Handle CSV upload ─── */
  const handleFileUpload = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parseResult = parseCSV(text);

      if (parseResult.transactions.length === 0) {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            "I couldn't read that file. Try exporting a CSV from your bank's website — usually under Statements or Transaction History.",
          timestamp: new Date(),
          type: 'text',
        };
        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      // Process and categorize
      const processed: Transaction[] = parseResult.transactions.map((t, i) => ({
        id: `import-${i}-${Date.now()}`,
        date: t.date,
        amount: t.amount,
        description: t.description,
        category: categorize(t.description, t.amount),
        source: 'wells-fargo' as const,
      }));

      // Save to store
      addTransactions(processed);
      const budgets = generateBudgets();
      setBudgets(budgets);

      // Build summary
      const expenses = processed.filter((t) => t.amount < 0);
      const income = processed.filter(
        (t) => t.amount > 0 && t.category === 'Income'
      );
      const months = new Set(processed.map((t) => t.date.slice(0, 7)));
      const monthCount = Math.max(months.size, 1);

      const categoryTotals: Record<string, number> = {};
      for (const t of expenses) {
        categoryTotals[t.category] =
          (categoryTotals[t.category] || 0) + Math.abs(t.amount);
      }

      const totalSpent = expenses.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      );
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([category, total]) => ({
          category,
          total: Math.round(total / monthCount),
          percentage: Math.round((total / totalSpent) * 100),
        }));

      // Generate a surprising insight
      let surprisingInsight: string | undefined;
      if (topCategories.length >= 2) {
        const top = topCategories[0];
        const second = topCategories[1];
        if (top.category !== 'Housing' && top.category !== 'Transfer') {
          surprisingInsight = `${top.category} is the biggest spending category at $${top.total}/mo — more than ${second.category}`;
        } else if (topCategories.length >= 3) {
          const third = topCategories[2];
          surprisingInsight = `After ${top.category}, the next biggest spend is ${second.category} at $${second.total}/mo, followed closely by ${third.category} at $${third.total}/mo`;
        }
      }

      const summary: TransactionSummary = {
        totalTransactions: processed.length,
        months: monthCount,
        topCategories,
        totalIncome: Math.round(totalIncome / monthCount),
        totalSpent: Math.round(totalSpent / monthCount),
        monthlyAvgSpent: Math.round(totalSpent / monthCount),
        surprisingInsight,
      };

      setUploadedData(summary);
      setShowUpload(false);

      // Add a system message about the upload
      const uploadMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: `[Uploaded ${processed.length} transactions across ${monthCount} month${monthCount > 1 ? 's' : ''}]`,
        timestamp: new Date(),
        type: 'text',
      };
      setMessages((prev) => [...prev, uploadMsg]);

      // Automatically trigger next AI turn with the data
      setIsLoading(true);

      try {
        const history = [
          ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: `I just uploaded my bank transactions. ${processed.length} transactions over ${monthCount} months.` },
        ];

        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            turn: Math.max(turn, 4),
            transactionSummary: summary,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            type: data.plan ? 'plan' : 'text',
            plan: data.plan || undefined,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setTurn(data.turn);
          if (data.plan) setPlan(data.plan);
        }
      } catch (error) {
        console.error('Post-upload error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, turn]
  );

  /* ─── Finish onboarding ─── */
  const finishOnboarding = useCallback(() => {
    // Extract name from conversation (first user message likely has it)
    const firstUserMsg = messages.find((m) => m.role === 'user' && m.type === 'text');
    const nameGuess = firstUserMsg?.content.match(/(?:i'm|im|my name is|i am|call me)\s+(\w+)/i)?.[1] || '';

    setUser({
      name: nameGuess,
      personality: plan?.archetype || '',
      primaryGoal: plan?.recommendation || '',
      takeHomeIncome: plan?.monthlyIncome || 0,
      onboardingComplete: true,
    });

    router.push('/chat');
  }, [messages, plan, router]);

  /* ─── Drag & drop ─── */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && file.name.endsWith('.csv')) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  /* ─── Key handler ─── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  /* ─── Render ─── */
  return (
    <div
      className="flex flex-col h-dvh bg-background"
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="border-2 border-dashed border-amber-500/50 rounded-2xl p-12 text-center">
            <Upload className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-lg text-amber-500">Drop your bank CSV here</p>
          </div>
        </div>
      )}

      {/* Welcome splash */}
      {showWelcome && (
        <div className="fixed inset-0 z-40 bg-background flex items-center justify-center animate-fade-out">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Pockets</h1>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-medium">Pockets</h1>
          <p className="text-xs text-muted-foreground">Getting to know you</p>
        </div>
        {/* Subtle progress dots */}
        <div className="ml-auto flex gap-1.5">
          {[1, 2, 3, 4, 5].map((t) => (
            <div
              key={t}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                t < turn
                  ? 'bg-amber-500'
                  : t === turn
                  ? 'bg-amber-500/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
          >
            {msg.type === 'plan' && msg.plan ? (
              <PlanCard plan={msg.plan} content={msg.content} />
            ) : (
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-600/20 text-foreground rounded-br-md'
                    : 'bg-card text-foreground rounded-bl-md'
                } ${
                  msg.content.startsWith('[Uploaded') ? 'text-xs text-muted-foreground italic bg-transparent' : ''
                }`}
              >
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start animate-slide-up">
            <div className="bg-card px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Upload prompt */}
        {showUpload && !isLoading && (
          <div className="flex justify-center animate-slide-up">
            <Card className="bg-card/50 border-amber-500/20 p-4 max-w-sm text-center">
              <Upload className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm mb-3">
                Upload a bank CSV to get personalized insights
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    setShowUpload(false);
                    sendMessage("I don't have a CSV right now, let's skip that for now.");
                  }}
                >
                  Skip
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        {plan ? (
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 h-12 text-base font-medium"
            onClick={finishOnboarding}
          >
            <Check className="w-4 h-4 mr-2" />
            Let&apos;s go — take me to my dashboard
          </Button>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  turn === 1
                    ? "What's on your mind about money..."
                    : 'Type your response...'
                }
                disabled={isLoading}
                className="h-12 pr-12 bg-card border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-amber-500/30"
              />
              <Button
                size="icon"
                disabled={!input.trim() || isLoading}
                onClick={() => sendMessage()}
                className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-30 disabled:bg-muted"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Plan Card Component ─────────────── */

function PlanCard({ plan, content }: { plan: BudgetPlan; content: string }) {
  const formatMoney = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="w-full space-y-3 animate-slide-up">
      {/* AI message */}
      <div className="bg-card px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed max-w-[85%]">
        {content}
      </div>

      {/* Plan card */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-amber-500/20 p-5 space-y-4">
        <div className="text-center">
          <p className="text-xs text-amber-500 uppercase tracking-wider font-medium mb-1">
            Your Cost to Be You
          </p>
          <p className="text-3xl font-bold">
            {formatMoney(plan.costToBeYou)}
            <span className="text-base font-normal text-muted-foreground">/mo</span>
          </p>
          {plan.monthlyIncome > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              on {formatMoney(plan.monthlyIncome)}/mo income
            </p>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <CategorySection title="Needs" items={plan.categories.needs} color="emerald" />
          <CategorySection title="Wants" items={plan.categories.wants} color="amber" />
          <CategorySection title="Goals" items={plan.categories.goals} color="blue" />
        </div>

        {/* Insight */}
        {plan.insight && (
          <div className="bg-amber-500/10 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-400">{plan.insight}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CategorySection({
  title,
  items,
  color,
}: {
  title: string;
  items: { name: string; amount: number }[];
  color: 'emerald' | 'amber' | 'blue';
}) {
  if (!items || items.length === 0) return null;

  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className={`text-xs font-medium ${colorMap[color].split(' ')[0]}`}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground">
          ${total.toLocaleString()}/mo
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex justify-between items-center text-sm py-1 px-2 rounded-md hover:bg-muted/30 transition-colors"
          >
            <span className="text-foreground/80">{item.name}</span>
            <span className="text-muted-foreground text-xs">
              ${item.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
