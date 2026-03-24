'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  UtensilsCrossed,
  Fuel,
  Repeat,
  Car,
  Zap,
  Home,
  ShoppingBag,
  Heart,
  ArrowLeftRight,
  Ticket,
  Shield,
  GraduationCap,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  getTransactions,
  getMonthlySnapshot,
  getCategoryBreakdown,
  getAvailableMonths,
  getBudgets,
  generateBudgets,
  setBudgets,
  type Budget,
  type CategoryBreakdown,
} from '@/lib/store';
import { type Category, getCategoryColor } from '@/lib/import/categorizer';

/* ──────── Icon Map ──────── */
const CATEGORY_ICONS: Record<Category, React.ElementType> = {
  Grocery: ShoppingCart,
  Dining: UtensilsCrossed,
  Gas: Fuel,
  Subscriptions: Repeat,
  Transport: Car,
  Utilities: Zap,
  Housing: Home,
  Income: TrendingUp,
  Shopping: ShoppingBag,
  Health: Heart,
  Transfer: ArrowLeftRight,
  Entertainment: Ticket,
  Insurance: Shield,
  Education: GraduationCap,
  Other: HelpCircle,
};

/* ──────── Custom Tooltip ──────── */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0A0A0F',
        border: '1px solid #2A2A3A',
        borderRadius: '12px',
        padding: '10px 14px',
      }}
    >
      {label && (
        <p style={{ color: '#FFFFFF', fontSize: '11px', marginBottom: '4px' }}>{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || '#4ADE80', fontSize: '13px', fontWeight: 600 }}>
          ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
}

/* ──────── Page ──────── */
export default function InsightsPage() {
  const [transactions, setTransactionsState] = useState<ReturnType<typeof getTransactions>>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [budgets, setBudgetsState] = useState<Budget[]>([]);

  useEffect(() => {
    const txns = getTransactions();
    const availMonths = getAvailableMonths();
    let storedBudgets = getBudgets();

    if (storedBudgets.length === 0 && txns.length > 0) {
      storedBudgets = generateBudgets();
      setBudgets(storedBudgets);
    }

    setTransactionsState(txns);
    setMonths(availMonths);
    setSelectedMonth(availMonths[0] || new Date().toISOString().slice(0, 7));
    setBudgetsState(storedBudgets);
  }, []);

  const snapshot = useMemo(() => getMonthlySnapshot(selectedMonth), [selectedMonth, transactions]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(selectedMonth), [selectedMonth, transactions]);

  // Monthly trend data
  const trendData = useMemo(() => {
    return months
      .slice(0, 12)
      .reverse()
      .map((m) => {
        const snap = getMonthlySnapshot(m);
        const label = new Date(m + '-01').toLocaleDateString('en-US', {
          month: 'short',
        });
        return { name: label, earned: snap.earned, spent: snap.spent };
      });
  }, [months, transactions]);

  // Month navigation
  const currentMonthIdx = months.indexOf(selectedMonth);
  const canGoBack = currentMonthIdx < months.length - 1;
  const canGoForward = currentMonthIdx > 0;

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  if (transactions.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center px-6 pb-20" style={{ background: '#0A0A0F' }}>
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
        >
          <BarChart3 className="h-6 w-6" style={{ color: '#8888A0' }} />
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
          No data yet
        </h2>
        <p className="max-w-xs text-center text-sm" style={{ color: '#8888A0' }}>
          Import your bank transactions to see spending breakdowns, budgets, and trends.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24" style={{ background: '#0A0A0F' }}>
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: '#2A2A3A' }}>
        <button
          onClick={() => canGoBack && setSelectedMonth(months[currentMonthIdx + 1])}
          disabled={!canGoBack}
          className="rounded-xl p-2 transition-opacity disabled:opacity-20"
          style={{ background: '#1A1A24' }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: '#8888A0' }} />
        </button>
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
          {monthLabel}
        </h1>
        <button
          onClick={() => canGoForward && setSelectedMonth(months[currentMonthIdx - 1])}
          disabled={!canGoForward}
          className="rounded-xl p-2 transition-opacity disabled:opacity-20"
          style={{ background: '#1A1A24' }}
        >
          <ChevronRight className="h-4 w-4" style={{ color: '#8888A0' }} />
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        {/* ──── Snapshot Cards ──── */}
        <div className="grid grid-cols-3 gap-3">
          <SnapshotCard icon={TrendingUp} label="Earned" value={snapshot.earned} color="#4ADE80" />
          <SnapshotCard icon={TrendingDown} label="Spent" value={snapshot.spent} color="#F87171" />
          <SnapshotCard icon={Wallet} label="Flexible" value={snapshot.flexible} color="#D4A853" />
        </div>

        {/* ──── Spending by Category ──── */}
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
            Spending by Category
          </h2>
          <div
            className="rounded-2xl p-4"
            style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={categoryBreakdown.slice(0, 8).map((c) => ({
                  name: c.category,
                  value: c.total,
                  fill: getCategoryColor(c.category),
                }))}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#8888A0', fontSize: 10 }}
                  axisLine={{ stroke: '#2A2A3A' }}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: '#8888A0', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {categoryBreakdown.slice(0, 8).map((c, i) => (
                    <Cell key={i} fill={getCategoryColor(c.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ──── Category List ──── */}
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
            Category Breakdown
          </h2>
          <div className="space-y-2">
            {categoryBreakdown.map((cat) => (
              <CategoryRow key={cat.category} data={cat} budget={budgets.find((b) => b.category === cat.category)} />
            ))}
          </div>
        </section>

        {/* ──── Monthly Trend ──── */}
        {trendData.length > 1 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
              Monthly Trend
            </h2>
            <div
              className="rounded-2xl p-4"
              style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
            >
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#8888A0', fontSize: 11 }}
                    axisLine={{ stroke: '#2A2A3A' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#8888A0', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="earned"
                    stroke="#4ADE80"
                    strokeWidth={2}
                    dot={{ fill: '#4ADE80', r: 3, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="spent"
                    stroke="#F87171"
                    strokeWidth={2}
                    dot={{ fill: '#F87171', r: 3, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: '#4ADE80' }} />
                  <span className="text-[11px]" style={{ color: '#8888A0' }}>
                    Earned
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: '#F87171' }} />
                  <span className="text-[11px]" style={{ color: '#8888A0' }}>
                    Spent
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ──── Budget vs Actual ──── */}
        {budgets.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
              Budget vs Actual
            </h2>
            <div className="space-y-3">
              {budgets
                .filter((b) => b.limit > 0)
                .slice(0, 10)
                .map((budget) => {
                  const actual = categoryBreakdown.find((c) => c.category === budget.category);
                  const spent = actual?.total || 0;
                  const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
                  const isOver = pct > 100;

                  return (
                    <div
                      key={budget.category}
                      className="rounded-xl p-3"
                      style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: '#FFFFFF' }}>
                          {budget.category}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: isOver ? '#F87171' : '#4ADE80' }}
                        >
                          ${spent.toFixed(0)} / ${budget.limit}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#2A2A3A' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: isOver ? '#F87171' : getCategoryColor(budget.category),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ──────── Sub Components ──────── */

function SnapshotCard({
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
    <div
      className="flex flex-col items-center gap-2 rounded-2xl p-4"
      style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
    >
      <Icon className="h-4 w-4" style={{ color }} />
      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#8888A0' }}>
        {label}
      </p>
      <p className="text-lg font-bold" style={{ color }}>
        ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

function CategoryRow({
  data,
  budget,
}: {
  data: CategoryBreakdown;
  budget?: Budget;
}) {
  const Icon = CATEGORY_ICONS[data.category] || HelpCircle;
  const color = getCategoryColor(data.category);
  const budgetLimit = budget?.limit;
  const isOver = budgetLimit ? data.total > budgetLimit : false;

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}15` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
            {data.category}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: isOver ? '#F87171' : '#FFFFFF' }}
          >
            ${data.total.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: '#8888A0' }}>
            {data.count} transactions
          </span>
          <span className="text-[11px]" style={{ color: '#8888A0' }}>
            {data.percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
