'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  Upload,
  Building2,
  TrendingUp,
  PiggyBank,
  Target,
  Eye,
  Loader2,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
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
type Step = 0 | 1 | 2 | 3 | 4 | 5;

const TOTAL_STEPS = 6;

/* ─────────────── Page ─────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [checkingFloor, setCheckingFloor] = useState(5000);
  const [monthlyInvest, setMonthlyInvest] = useState(1500);
  const [takeHomeIncome, setTakeHomeIncome] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const next = useCallback(() => {
    setStep((s) => (s < 5 ? ((s + 1) as Step) : s));
  }, []);

  const saveProfile = useCallback(() => {
    setUser({
      name,
      personality,
      primaryGoal,
      checkingFloor,
      monthlyInvest,
      takeHomeIncome,
      onboardingComplete: true,
    });
  }, [name, personality, primaryGoal, checkingFloor, monthlyInvest, takeHomeIncome]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        const text = await file.text();
        const result = parseCSV(text);

        // Categorize and create Transaction objects
        const transactions: Transaction[] = result.transactions.map((raw) => ({
          id: crypto.randomUUID(),
          date: raw.date,
          amount: raw.amount,
          description: raw.description,
          category: categorize(raw.description, raw.amount),
          checkNumber: raw.checkNumber,
          source: raw.source,
        }));

        // Simulate processing animation
        for (let i = 0; i <= transactions.length; i++) {
          setProcessedCount(i);
          await new Promise((r) => setTimeout(r, Math.max(5, 1500 / transactions.length)));
        }

        // Save everything
        saveProfile();
        addTransactions(transactions);
        const budgets = generateBudgets();
        setBudgets(budgets);

        // Brief pause to show completion
        await new Promise((r) => setTimeout(r, 800));
        router.push('/chat');
      } catch (err) {
        console.error('CSV parse error:', err);
        setIsProcessing(false);
      }
    },
    [saveProfile, router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const skipToChat = useCallback(() => {
    saveProfile();
    router.push('/chat');
  }, [saveProfile, router]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0A0A0F' }}>
      {/* Gradient orb */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)' }} />

      {/* Progress */}
      <div className="fixed left-0 right-0 top-0 z-50 px-6 pt-6">
        <div className="mx-auto max-w-md">
          <div className="h-0.5 w-full rounded-full" style={{ background: '#2A2A3A' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                background: '#4ADE80',
              }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {step === 0 && <SplashStep onContinue={next} />}
        {step === 1 && <NameStep name={name} setName={setName} onContinue={next} />}
        {step === 2 && (
          <PersonalityStep personality={personality} setPersonality={setPersonality} onContinue={next} />
        )}
        {step === 3 && (
          <GoalStep goal={primaryGoal} setGoal={setPrimaryGoal} onContinue={next} />
        )}
        {step === 4 && (
          <FloorStep
            checkingFloor={checkingFloor}
            setCheckingFloor={setCheckingFloor}
            monthlyInvest={monthlyInvest}
            setMonthlyInvest={setMonthlyInvest}
            takeHomeIncome={takeHomeIncome}
            setTakeHomeIncome={setTakeHomeIncome}
            onContinue={next}
          />
        )}
        {step === 5 && (
          isProcessing ? (
            <ProcessingStep count={processedCount} />
          ) : (
            <CSVUploadStep
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              handleDrop={handleDrop}
              fileInputRef={fileInputRef}
              handleFileUpload={handleFileUpload}
              onSkip={skipToChat}
            />
          )
        )}
      </div>
    </div>
  );
}

/* ──────────── Step Components ──────────── */

function SplashStep({ onContinue }: { onContinue: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div className={`flex flex-col items-center text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Logo */}
      <div
        className="mb-10 flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{ background: '#1A1A24', border: '1px solid #2A2A3A' }}
      >
        <DollarSign className="h-10 w-10" style={{ color: '#4ADE80' }} />
      </div>

      <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: '#FFFFFF' }}>
        CashPilot
      </h1>
      <p className="mb-2 text-lg" style={{ color: '#8888A0' }}>
        Your money, one conversation away.
      </p>
      <p className="mb-16 text-sm" style={{ color: '#555570' }}>
        Set goals. Ask questions. Get answers — not spreadsheets.
      </p>

      <Button
        onClick={onContinue}
        className="h-14 w-full max-w-xs rounded-2xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: '#4ADE80', color: '#0A0A0F' }}
      >
        Get Started
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function NameStep({
  name,
  setName,
  onContinue,
}: {
  name: string;
  setName: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="mb-3 text-3xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        What should I call you?
      </h2>
      <p className="mb-10 text-sm" style={{ color: '#8888A0' }}>
        Just your first name is fine.
      </p>

      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoFocus
        className="h-14 w-full max-w-xs rounded-2xl border text-center text-xl font-light tracking-wide"
        style={{
          background: '#1A1A24',
          borderColor: '#2A2A3A',
          color: '#FFFFFF',
        }}
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && onContinue()}
      />

      <Button
        onClick={onContinue}
        disabled={!name.trim()}
        className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
        style={{ background: '#4ADE80', color: '#0A0A0F' }}
      >
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function PersonalityStep({
  personality,
  setPersonality,
  onContinue,
}: {
  personality: string;
  setPersonality: (v: string) => void;
  onContinue: () => void;
}) {
  const chips = [
    'Be direct and numbers-focused',
    'Keep it casual and friendly',
    'Challenge me to do better',
    'Explain things simply',
    'Be encouraging and supportive',
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="mb-3 text-3xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        How should I talk to you?
      </h2>
      <p className="mb-8 text-sm" style={{ color: '#8888A0' }}>
        Describe your ideal financial advisor's tone.
      </p>

      <textarea
        value={personality}
        onChange={(e) => setPersonality(e.target.value)}
        placeholder="e.g., Be direct and no-nonsense. I want raw numbers and honest assessments. Don't sugarcoat things."
        rows={4}
        className="w-full max-w-sm resize-none rounded-2xl border p-4 text-sm leading-relaxed placeholder:opacity-40"
        style={{
          background: '#1A1A24',
          borderColor: '#2A2A3A',
          color: '#FFFFFF',
        }}
      />

      {/* Example chips */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => setPersonality(personality ? `${personality}. ${chip}` : chip)}
            className="rounded-full px-3 py-1.5 text-xs transition-all hover:scale-105"
            style={{
              background: '#1A1A24',
              border: '1px solid #2A2A3A',
              color: '#8888A0',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <Button
        onClick={onContinue}
        className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: '#4ADE80', color: '#0A0A0F' }}
      >
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function GoalStep({
  goal,
  setGoal,
  onContinue,
}: {
  goal: string;
  setGoal: (v: string) => void;
  onContinue: () => void;
}) {
  const goals = [
    { id: 'invest', label: 'Invest More', desc: 'Build long-term wealth', icon: TrendingUp },
    { id: 'save', label: 'Save Money', desc: 'Grow your safety net', icon: PiggyBank },
    { id: 'target', label: 'Hit a Target', desc: 'Reach a specific amount', icon: Target },
    { id: 'clarity', label: 'Get Clarity', desc: 'Understand where money goes', icon: Eye },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="mb-3 text-3xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        What's your main goal?
      </h2>
      <p className="mb-10 text-sm" style={{ color: '#8888A0' }}>
        We'll tailor insights around this.
      </p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {goals.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setGoal(id)}
            className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all hover:scale-[1.02]"
            style={{
              background: goal === id ? '#1A1A24' : 'transparent',
              borderColor: goal === id ? '#4ADE80' : '#2A2A3A',
            }}
          >
            <Icon
              className="h-6 w-6"
              style={{ color: goal === id ? '#4ADE80' : '#8888A0' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                {label}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: '#8888A0' }}>
                {desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Button
        onClick={onContinue}
        disabled={!goal}
        className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
        style={{ background: '#4ADE80', color: '#0A0A0F' }}
      >
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function FloorStep({
  checkingFloor,
  setCheckingFloor,
  monthlyInvest,
  setMonthlyInvest,
  takeHomeIncome,
  setTakeHomeIncome,
  onContinue,
}: {
  checkingFloor: number;
  setCheckingFloor: (v: number) => void;
  monthlyInvest: number;
  setMonthlyInvest: (v: number) => void;
  takeHomeIncome: number;
  setTakeHomeIncome: (v: number) => void;
  onContinue: () => void;
}) {
  const [subStep, setSubStep] = useState(0);

  const fields = [
    { label: 'Monthly take-home income', value: takeHomeIncome, setter: setTakeHomeIncome, placeholder: '6,000' },
    { label: 'Checking account floor', value: checkingFloor, setter: setCheckingFloor, placeholder: '5,000' },
    { label: 'Monthly investment target', value: monthlyInvest, setter: setMonthlyInvest, placeholder: '1,500' },
  ];

  const current = fields[subStep];
  const canContinue = current.value > 0;

  const handleNext = () => {
    if (subStep < fields.length - 1) {
      setSubStep(subStep + 1);
    } else {
      onContinue();
    }
  };

  // Show income bar visualization when on floor/invest steps
  const showBar = subStep > 0 && takeHomeIncome > 0;
  const committed = checkingFloor * 0 + monthlyInvest; // floor isn't monthly so don't include
  const flexible = Math.max(0, takeHomeIncome - committed);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Sub-step dots */}
      <div className="mb-8 flex gap-2">
        {fields.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: i === subStep ? '32px' : '6px',
              background: i === subStep ? '#4ADE80' : i < subStep ? '#8888A0' : '#2A2A3A',
            }}
          />
        ))}
      </div>

      <h2 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: '#FFFFFF' }}>
        {current.label}
      </h2>

      <div className="relative w-full max-w-xs">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl" style={{ color: '#8888A0' }}>
          $
        </span>
        <Input
          type="number"
          value={current.value || ''}
          onChange={(e) => current.setter(Number(e.target.value))}
          placeholder={current.placeholder}
          autoFocus
          className="h-16 rounded-2xl border pl-10 text-center text-3xl font-light tracking-wide"
          style={{
            background: '#1A1A24',
            borderColor: '#2A2A3A',
            color: '#FFFFFF',
          }}
          onKeyDown={(e) => e.key === 'Enter' && canContinue && handleNext()}
        />
      </div>

      {/* Income bar visualization */}
      {showBar && (
        <div className="mt-8 w-full max-w-xs">
          <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: '#2A2A3A' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (monthlyInvest / takeHomeIncome) * 100)}%`,
                background: '#4ADE80',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100 - (monthlyInvest / takeHomeIncome) * 100, (flexible / takeHomeIncome) * 100)}%`,
                background: '#D4A853',
              }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs" style={{ color: '#8888A0' }}>
            <span>
              <span style={{ color: '#4ADE80' }}>Invest</span> ${monthlyInvest.toLocaleString()}
            </span>
            <span>
              <span style={{ color: '#D4A853' }}>Flexible</span> ${flexible.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <Button
        onClick={handleNext}
        disabled={!canContinue}
        className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
        style={{ background: '#4ADE80', color: '#0A0A0F' }}
      >
        {subStep < fields.length - 1 ? 'Continue' : 'Almost done'}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function CSVUploadStep({
  isDragging,
  setIsDragging,
  handleDrop,
  fileInputRef,
  handleFileUpload,
  onSkip,
}: {
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (file: File) => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="mb-3 text-3xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        Import your data
      </h2>
      <p className="mb-10 text-sm" style={{ color: '#8888A0' }}>
        Upload a CSV from your bank. Wells Fargo format auto-detected.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full max-w-sm cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-12 transition-all duration-300"
        style={{
          borderColor: isDragging ? '#4ADE80' : '#2A2A3A',
          background: isDragging ? 'rgba(74,222,128,0.05)' : 'rgba(26,26,36,0.3)',
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: '#1A1A24' }}
        >
          <Upload className="h-6 w-6" style={{ color: '#8888A0' }} />
        </div>
        <div>
          <p className="font-medium" style={{ color: '#FFFFFF' }}>
            Drop your CSV here
          </p>
          <p className="mt-1 text-sm" style={{ color: '#555570' }}>
            or click to browse
          </p>
        </div>
      </div>

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

      {/* Bank connect — coming soon */}
      <button
        disabled
        className="mt-6 flex w-full max-w-sm items-center gap-4 rounded-2xl border px-6 py-4 text-left opacity-40"
        style={{ background: 'rgba(26,26,36,0.3)', borderColor: '#2A2A3A' }}
      >
        <Building2 className="h-5 w-5" style={{ color: '#555570' }} />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: '#8888A0' }}>
            Connect your bank
          </p>
          <p className="text-xs" style={{ color: '#555570' }}>
            Automatic sync
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{ background: '#1A1A24', color: '#555570' }}
        >
          Soon
        </span>
      </button>

      <button
        onClick={onSkip}
        className="mt-10 text-sm transition-colors hover:opacity-80"
        style={{ color: '#555570' }}
      >
        Skip for now
      </button>
    </div>
  );
}

function ProcessingStep({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-8">
        {count > 0 ? (
          <CheckCircle2 className="h-16 w-16 animate-pulse" style={{ color: '#4ADE80' }} />
        ) : (
          <Loader2 className="h-16 w-16 animate-spin" style={{ color: '#4ADE80' }} />
        )}
      </div>

      <h2 className="mb-3 text-2xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
        {count > 0 ? 'Processing transactions...' : 'Reading your data...'}
      </h2>

      <p className="text-lg font-light" style={{ color: '#4ADE80' }}>
        {count > 0 ? `${count} transactions categorized` : 'Hang tight'}
      </p>

      <div className="mt-8 w-full max-w-xs">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: '#2A2A3A' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: '100%', background: '#4ADE80', animation: 'pulse 1.5s infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
