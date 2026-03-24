'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  MessageSquare,
  Target,
  DollarSign,
  TrendingUp,
  Wallet,
  Upload,
  Trash2,
  Download,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getUser,
  setUser,
  getTransactions,
  addTransactions,
  clearTransactions,
  resetAll,
  generateBudgets,
  setBudgets,
  type UserProfile,
  type Transaction,
} from '@/lib/store';
import { parseCSV } from '@/lib/import/csv-parser';
import { categorize } from '@/lib/import/categorizer';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [txnCount, setTxnCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(getUser());
    setTxnCount(getTransactions().length);
  }, []);

  if (!profile) return null;

  const save = (updates: Partial<UserProfile>) => {
    const updated = setUser(updates);
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const result = parseCSV(text);
    const transactions: Transaction[] = result.transactions.map((raw) => ({
      id: crypto.randomUUID(),
      date: raw.date,
      amount: raw.amount,
      description: raw.description,
      category: categorize(raw.description, raw.amount),
      checkNumber: raw.checkNumber,
      source: raw.source,
    }));
    addTransactions(transactions);
    const budgets = generateBudgets();
    setBudgets(budgets);
    setTxnCount(getTransactions().length);
  };

  const handleExport = () => {
    const txns = getTransactions();
    const csv = [
      'Date,Amount,Description,Category',
      ...txns.map(
        (t) =>
          `${new Date(t.date).toLocaleDateString()},${t.amount},"${t.description}",${t.category}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cashpilot-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm('This will delete all your data. Are you sure?')) {
      resetAll();
      router.replace('/onboarding');
    }
  };

  return (
    <div className="min-h-dvh pb-24" style={{ background: '#0A0A0F' }}>
      <header
        className="border-b px-4 py-4 text-center"
        style={{ borderColor: '#2A2A3A' }}
      >
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: '#FFFFFF' }}>
          Settings
        </h1>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        {/* Saved indicator */}
        {saved && (
          <div
            className="rounded-xl px-4 py-2 text-center text-sm font-medium"
            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ADE80' }}
          >
            Settings saved
          </div>
        )}

        {/* Profile Section */}
        <Section title="Profile">
          <SettingRow icon={User} label="Name">
            <Input
              value={profile.name}
              onChange={(e) => save({ name: e.target.value })}
              className="h-9 w-40 rounded-lg border text-right text-sm"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            />
          </SettingRow>
          <SettingRow icon={MessageSquare} label="Communication Style">
            <textarea
              value={profile.personality}
              onChange={(e) => save({ personality: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-lg border p-2 text-xs"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            />
          </SettingRow>
        </Section>

        {/* Financial Goals */}
        <Section title="Financial Goals">
          <SettingRow icon={Target} label="Primary Goal">
            <select
              value={profile.primaryGoal}
              onChange={(e) => save({ primaryGoal: e.target.value })}
              className="h-9 rounded-lg border px-2 text-sm"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            >
              <option value="invest">Invest More</option>
              <option value="save">Save Money</option>
              <option value="target">Hit a Target</option>
              <option value="clarity">Get Clarity</option>
            </select>
          </SettingRow>
          <SettingRow icon={DollarSign} label="Take-home Income">
            <Input
              type="number"
              value={profile.takeHomeIncome || ''}
              onChange={(e) => save({ takeHomeIncome: Number(e.target.value) })}
              className="h-9 w-32 rounded-lg border text-right text-sm"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            />
          </SettingRow>
          <SettingRow icon={Wallet} label="Checking Floor">
            <Input
              type="number"
              value={profile.checkingFloor || ''}
              onChange={(e) => save({ checkingFloor: Number(e.target.value) })}
              className="h-9 w-32 rounded-lg border text-right text-sm"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            />
          </SettingRow>
          <SettingRow icon={TrendingUp} label="Monthly Invest">
            <Input
              type="number"
              value={profile.monthlyInvest || ''}
              onChange={(e) => save({ monthlyInvest: Number(e.target.value) })}
              className="h-9 w-32 rounded-lg border text-right text-sm"
              style={{ background: '#0A0A0F', borderColor: '#2A2A3A', color: '#FFFFFF' }}
            />
          </SettingRow>
        </Section>

        {/* Data Management */}
        <Section title="Data">
          <SettingRow icon={FileText} label="Transactions">
            <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>
              {txnCount.toLocaleString()}
            </span>
          </SettingRow>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl text-xs"
              style={{ background: '#1A1A24', color: '#FFFFFF', border: '1px solid #2A2A3A' }}
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              onClick={handleExport}
              disabled={txnCount === 0}
              className="flex-1 rounded-xl text-xs disabled:opacity-30"
              style={{ background: '#1A1A24', color: '#FFFFFF', border: '1px solid #2A2A3A' }}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone">
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (confirm('Delete all transactions?')) {
                  clearTransactions();
                  setTxnCount(0);
                }
              }}
              className="flex-1 rounded-xl text-xs"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Clear Transactions
            </Button>
            <Button
              onClick={handleReset}
              className="flex-1 rounded-xl text-xs"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Reset Everything
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ──── Sub Components ──── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8888A0' }}>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0" style={{ color: '#8888A0' }} />
      <span className="flex-1 text-sm" style={{ color: '#FFFFFF' }}>
        {label}
      </span>
      {children}
    </div>
  );
}
