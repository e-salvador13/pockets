/**
 * CashPilot Local Storage
 * Browser localStorage-based state management for v1.
 */

import { type Category } from '@/lib/import/categorizer';

/* ───────────────────── Types ───────────────────── */

export interface Transaction {
  id: string;
  date: string;         // ISO string
  amount: number;       // positive = income, negative = expense
  description: string;
  category: Category;
  checkNumber?: string;
  source: 'wells-fargo' | 'generic';
}

export interface Budget {
  category: Category;
  limit: number;        // monthly budget limit (positive number)
  period: 'monthly';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;    // ISO string
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  personality: string;
  primaryGoal: string;
  checkingFloor: number;
  monthlyInvest: number;
  takeHomeIncome: number;
  onboardingComplete: boolean;
}

export interface AppState {
  user: UserProfile;
  transactions: Transaction[];
  budgets: Budget[];
  conversations: Conversation[];
}

/* ───────────────────── Storage Keys ───────────────────── */

const STORAGE_KEYS = {
  user: 'cashpilot_user',
  transactions: 'cashpilot_transactions',
  budgets: 'cashpilot_budgets',
  conversations: 'cashpilot_conversations',
} as const;

/* ───────────────────── Default Values ───────────────────── */

const DEFAULT_USER: UserProfile = {
  name: '',
  personality: '',
  primaryGoal: '',
  checkingFloor: 5000,
  monthlyInvest: 1500,
  takeHomeIncome: 0,
  onboardingComplete: false,
};

/* ───────────────────── Core Functions ───────────────────── */

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

/* ───────────────────── User Profile ───────────────────── */

export function getUser(): UserProfile {
  return getItem(STORAGE_KEYS.user, DEFAULT_USER);
}

export function setUser(user: Partial<UserProfile>): UserProfile {
  const current = getUser();
  const updated = { ...current, ...user };
  setItem(STORAGE_KEYS.user, updated);
  return updated;
}

export function isOnboardingComplete(): boolean {
  return getUser().onboardingComplete;
}

/* ───────────────────── Transactions ───────────────────── */

export function getTransactions(): Transaction[] {
  return getItem(STORAGE_KEYS.transactions, []);
}

export function setTransactions(transactions: Transaction[]): void {
  setItem(STORAGE_KEYS.transactions, transactions);
}

export function addTransactions(newTransactions: Transaction[]): Transaction[] {
  const existing = getTransactions();
  // Deduplicate by date + amount + description
  const existingKeys = new Set(
    existing.map(t => `${t.date}|${t.amount}|${t.description}`)
  );
  const toAdd = newTransactions.filter(
    t => !existingKeys.has(`${t.date}|${t.amount}|${t.description}`)
  );
  const all = [...existing, ...toAdd];
  setTransactions(all);
  return all;
}

export function clearTransactions(): void {
  setTransactions([]);
}

/* ───────────────────── Budgets ───────────────────── */

export function getBudgets(): Budget[] {
  return getItem(STORAGE_KEYS.budgets, []);
}

export function setBudgets(budgets: Budget[]): void {
  setItem(STORAGE_KEYS.budgets, budgets);
}

/* ───────────────────── Conversations ───────────────────── */

export function getConversations(): Conversation[] {
  return getItem(STORAGE_KEYS.conversations, []);
}

export function getCurrentConversation(): Conversation {
  const conversations = getConversations();
  if (conversations.length === 0) {
    const newConvo: Conversation = {
      id: generateId(),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.conversations, [newConvo]);
    return newConvo;
  }
  return conversations[conversations.length - 1];
}

export function addMessageToConversation(message: ChatMessage): Conversation {
  const conversations = getConversations();
  let current: Conversation;

  if (conversations.length === 0) {
    current = {
      id: generateId(),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    conversations.push(current);
  } else {
    current = conversations[conversations.length - 1];
  }

  current.messages.push(message);
  current.updatedAt = new Date().toISOString();
  setItem(STORAGE_KEYS.conversations, conversations);
  return current;
}

export function startNewConversation(): Conversation {
  const conversations = getConversations();
  const newConvo: Conversation = {
    id: generateId(),
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  conversations.push(newConvo);
  setItem(STORAGE_KEYS.conversations, conversations);
  return newConvo;
}

/* ───────────────────── Analytics Helpers ───────────────────── */

export interface MonthlySnapshot {
  earned: number;
  spent: number;
  flexible: number;
  month: string; // YYYY-MM
}

export function getMonthlySnapshot(month?: string): MonthlySnapshot {
  const transactions = getTransactions();
  const user = getUser();
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const monthTransactions = transactions.filter(
    t => t.date.slice(0, 7) === targetMonth
  );

  const earned = monthTransactions
    .filter(t => t.amount > 0 && t.category === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const spent = monthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const committed = user.monthlyInvest + user.checkingFloor;
  const flexible = Math.max(0, earned - spent - committed);

  return { earned, spent, flexible, month: targetMonth };
}

export interface CategoryBreakdown {
  category: Category;
  total: number;
  count: number;
  percentage: number;
}

export function getCategoryBreakdown(month?: string): CategoryBreakdown[] {
  const transactions = getTransactions();
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const monthExpenses = transactions.filter(
    t => t.date.slice(0, 7) === targetMonth && t.amount < 0
  );

  const totalSpent = monthExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const grouped: Record<string, { total: number; count: number }> = {};
  for (const t of monthExpenses) {
    if (!grouped[t.category]) {
      grouped[t.category] = { total: 0, count: 0 };
    }
    grouped[t.category].total += Math.abs(t.amount);
    grouped[t.category].count++;
  }

  return Object.entries(grouped)
    .map(([category, data]) => ({
      category: category as Category,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      percentage: totalSpent > 0 ? Math.round((data.total / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getAvailableMonths(): string[] {
  const transactions = getTransactions();
  const months = new Set(transactions.map(t => t.date.slice(0, 7)));
  return Array.from(months).sort().reverse();
}

export interface RecurringCharge {
  description: string;
  amount: number;
  category: Category;
  frequency: 'monthly' | 'weekly';
  occurrences: number;
}

export function detectRecurringCharges(): RecurringCharge[] {
  const transactions = getTransactions();
  const expenses = transactions.filter(t => t.amount < 0);

  // Group by similar description and amount
  const groups: Record<string, Transaction[]> = {};
  for (const t of expenses) {
    // Normalize description for grouping
    const key = `${normalizeDesc(t.description)}|${Math.round(Math.abs(t.amount) * 100)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const recurring: RecurringCharge[] = [];
  for (const [, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;

    // Check if roughly monthly or weekly
    const dates = txns.map(t => new Date(t.date).getTime()).sort();
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    let frequency: 'monthly' | 'weekly' | null = null;
    if (avgGap >= 25 && avgGap <= 35) frequency = 'monthly';
    else if (avgGap >= 5 && avgGap <= 10) frequency = 'weekly';

    if (frequency) {
      recurring.push({
        description: txns[0].description,
        amount: Math.abs(txns[0].amount),
        category: txns[0].category,
        frequency,
        occurrences: txns.length,
      });
    }
  }

  return recurring.sort((a, b) => b.amount - a.amount);
}

/**
 * Auto-generate budgets from spending patterns.
 */
export function generateBudgets(): Budget[] {
  const months = getAvailableMonths();
  if (months.length === 0) return [];

  // Average spending per category across available months
  const allBreakdowns = months.map(m => getCategoryBreakdown(m));
  const categoryAverages: Record<string, number[]> = {};

  for (const breakdown of allBreakdowns) {
    for (const item of breakdown) {
      if (!categoryAverages[item.category]) {
        categoryAverages[item.category] = [];
      }
      categoryAverages[item.category].push(item.total);
    }
  }

  const budgets: Budget[] = [];
  for (const [category, amounts] of Object.entries(categoryAverages)) {
    if (category === 'Transfer' || category === 'Income') continue;
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    // Set budget at 110% of average (a little buffer)
    budgets.push({
      category: category as Category,
      limit: Math.round(avg * 1.1),
      period: 'monthly',
    });
  }

  return budgets.sort((a, b) => b.limit - a.limit);
}

/* ───────────────────── Reset ───────────────────── */

export function resetAll(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  });
}

/* ───────────────────── Helpers ───────────────────── */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}
