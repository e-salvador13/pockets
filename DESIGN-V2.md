# CashPilot v2 — Psychology-First Design

## Thesis
YNAB proved that changing your *relationship* with money works. But it makes you do all the work.
CashPilot v2: **AI does the tedious parts so users only engage with the emotional parts.**

## What's Changing from v1
| v1 | v2 |
|---|---|
| Step-by-step form onboarding | Conversational AI onboarding |
| CSV upload for transactions | Bank connection (Plaid/MX) + CSV fallback |
| Static budgets you set manually | AI-proposed budgets from your history |
| Passive dashboard | Proactive push notifications / coaching |
| Generic personality picker | Money archetype detection from conversation |
| "Here's your data" | "Here's what's interesting about your data" |

## Core Architecture

### 1. Conversational Onboarding (replaces step forms)
5 AI conversation turns instead of checkbox screens:

**Turn 1: Open-ended hook**
> "What's going on with your money right now? No wrong answers."

**Turn 2: Archetype detection** (AI responds with empathy + follow-up)
> "Sounds like you're a builder — you make good money but feel like it disappears. A lot of people in your position feel that way. What would 'in control' look like for you?"

**Turn 3: Goals with emotional weight**
> "If money wasn't stressful at all, what would change in your life?"

**Turn 4: Connect bank → instant insight**
> "Let me look at your last 3 months... Interesting — you spent $X on dining out, which is more than your car payment. Not judging, just noticing. Want me to build a plan around what matters to you?"

**Turn 5: AI-generated plan presentation**
> "Here's your 'Cost to Be You': $X/mo. I've organized it by what you told me matters. Adjust anything that feels off."

### 2. Money Archetypes
Detected from conversation, not a quiz. Influences tone and advice:
- **The Builder** — Makes good money, wants to optimize and grow wealth
- **The Survivor** — Living paycheck to paycheck, needs breathing room
- **The Avoider** — Knows they should budget, keeps putting it off
- **The Optimizer** — Already tracks everything, wants to squeeze more out
- **The Dreamer** — Has big goals but no plan to get there

### 3. AI Smart Budget ("Cost to Be You")
- Analyzes 3 months of bank history
- Auto-categorizes transactions (AI, not rule-based)
- Proposes budget that reflects ACTUAL behavior, not aspirational
- Highlights the gap: "You spend $X, you make $Y, here's the delta"
- Recommends where to cut based on YOUR stated goals

### 4. Smart Rebalancer
When overspending happens (it will):
- AI detects: "Dining out is $80 over budget with 10 days left"
- AI proposes: "Pull $40 from Entertainment, $40 from Shopping?"
- One tap to approve
- No shame, no red alerts — just "let's adjust"

### 5. Proactive Coaching (Push)
Weekly check-in (push notification / text):
- "You spent $X this week. On track for your savings goal. One thing to watch: grocery spending is trending 20% higher than last month."
- Monthly: "Your net worth grew by $X. Here's what contributed most."
- Milestone: "You've saved $5,000 toward your emergency fund! 🎉"

### 6. Reflect (AI-Powered)
Instead of YNAB's empty charts on day 1:
- Instant insights from bank history on first session
- "Your biggest spending category is X. Surprised?"
- "You spend 40% more on weekends vs weekdays"
- "Your income-to-essential ratio is X — here's what that means"

## Tech Decisions
- **Bank connection**: Plaid (start with) — most common, good docs
- **AI**: Claude via Anthropic SDK (already in v1)
- **State**: Keep Zustand store, extend for bank data
- **Push**: Web Push API for browser, later native via AppForge
- **Design**: Keep dark theme, but warmer — less "finance app", more "trusted advisor"

## What We Keep from v1
- Next.js 15 + App Router
- Shadcn UI components
- Claude chat integration
- Dashboard layout shell
- Zustand store (extend it)

## What We Rip Out
- Step-based onboarding → replace with chat
- Static personality picker → replace with AI detection
- Manual budget creation → replace with AI proposal
- CSV-only import → add Plaid, keep CSV as fallback

## Build Order
1. **Conversational onboarding** — the core experience change
2. **AI budget proposal** — from imported/connected data  
3. **Smart rebalancer** — the "roll with the punches" feature
4. **Proactive coaching** — push notifications
5. **Plaid integration** — bank connection (can use CSV meanwhile)

## Success Metric
"Time to emotional shift" — how quickly does a user go from "I should track my money" to "I feel in control of my money"?
- YNAB: ~3 months
- CashPilot target: < 1 week
