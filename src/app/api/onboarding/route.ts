/**
 * Pockets — Conversational Onboarding API
 * Guides users through a 5-turn AI conversation to understand their
 * money situation, detect their archetype, and build a personalized plan.
 */

import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'llama3';

interface OnboardingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OnboardingRequest {
  messages: OnboardingMessage[];
  turn: number;
  transactionSummary?: {
    totalTransactions: number;
    months: number;
    topCategories: { category: string; total: number; percentage: number }[];
    totalIncome: number;
    totalSpent: number;
    monthlyAvgSpent: number;
    surprisingInsight?: string;
  };
}

const SYSTEM_PROMPT = `You are Pockets, an AI personal finance assistant. You're having a conversation with a new user to understand their money situation before setting up their plan.

YOUR PERSONALITY:
- Warm, direct, no corporate speak
- Like a smart friend who's good with money
- Empathetic but not therapist-y
- Use their name once you learn it
- Short paragraphs, conversational tone
- No emojis in your responses
- Never say "Great question!" or similar filler

YOUR GOAL:
Guide the user through understanding their relationship with money in 5 conversational turns. Each turn builds on what they shared.

MONEY ARCHETYPES (detect from their language, don't name them explicitly):
- The Builder: Makes good money, wants to optimize and grow wealth. Language: "invest", "grow", "optimize", "maximize"
- The Survivor: Paycheck to paycheck, needs breathing room. Language: "behind", "catch up", "tight", "stressed"
- The Avoider: Knows they should budget, keeps putting it off. Language: "should", "tried before", "keep meaning to", "not sure where it goes"
- The Optimizer: Already tracks everything, wants to do more. Language: "spreadsheet", "track", "numbers", "system"
- The Dreamer: Big goals but no concrete plan. Language: "someday", "want to", "hope", "goal"

CONVERSATION FLOW:

Turn 1 (your opening — already sent by the app):
The app sends the first message. You respond to their answer.

Turn 2 (after their first real answer):
- Acknowledge what they said with genuine empathy
- Reflect back what you're hearing (make them feel understood)
- Ask: what would "in control" or "good with money" look like for them?

Turn 3 (after they describe their ideal):
- Connect their ideal to something concrete
- Ask about what's blocking them — what's the gap between where they are and where they want to be?

Turn 4 (after they share blockers):
- Summarize their situation in 2-3 sentences (show you've been listening)
- If transaction data is available, share ONE surprising or interesting insight from it
- Transition to building their plan: "I have a pretty good picture now. Let me put together a plan based on everything you've told me."

Turn 5 (plan presentation — when transaction data is available):
- Present their "Cost to Be You" — monthly spending organized into Needs, Wants, and Goals
- Reference specific things they mentioned (their goals, their blockers)
- Make one concrete recommendation based on their archetype
- End with encouragement that's specific to them, not generic

IMPORTANT RULES:
- Keep responses under 150 words (conversational, not essays)
- Each response should have exactly ONE question (don't overwhelm)
- In Turn 4-5, if no transaction data is provided, ask them to upload their bank export
- When transaction data IS provided, use real numbers — don't make up figures
- In your final response (turn 5), include a JSON block at the end wrapped in <plan> tags with the budget proposal:
  <plan>
  {
    "archetype": "builder|survivor|avoider|optimizer|dreamer",
    "monthlyIncome": 0,
    "costToBeYou": 0,
    "categories": {
      "needs": [{"name": "Rent", "amount": 0}, ...],
      "wants": [{"name": "Dining", "amount": 0}, ...],
      "goals": [{"name": "Emergency Fund", "amount": 0}, ...]
    },
    "insight": "One sentence surprising insight",
    "recommendation": "One concrete next step"
  }
  </plan>
`;

export async function POST(request: NextRequest) {
  try {
    const body: OnboardingRequest = await request.json();
    const { messages, turn, transactionSummary } = body;

    // Build the message list for Claude
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Add conversation history
    for (const msg of messages) {
      claudeMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // If transaction data is available, append it as context to the last user message
    if (transactionSummary && turn >= 4) {
      const lastMsg = claudeMessages[claudeMessages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg.content += `\n\n[SYSTEM: Transaction data has been uploaded. Here's a summary:
- ${transactionSummary.totalTransactions} transactions over ${transactionSummary.months} months
- Monthly income: ~$${transactionSummary.totalIncome.toLocaleString()}
- Monthly spending: ~$${transactionSummary.monthlyAvgSpent.toLocaleString()}
- Top categories: ${transactionSummary.topCategories.map(c => `${c.category}: $${c.total.toLocaleString()} (${c.percentage}%)`).join(', ')}
${transactionSummary.surprisingInsight ? `- Interesting finding: ${transactionSummary.surprisingInsight}` : ''}
Current turn: ${turn}. ${turn >= 5 ? 'Present the plan now with the <plan> JSON block.' : 'Share an insight from this data.'}]`;
      }
    } else if (turn >= 4) {
      // No data yet — remind to ask for upload
      const lastMsg = claudeMessages[claudeMessages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg.content += `\n\n[SYSTEM: No transaction data uploaded yet. Current turn: ${turn}. Suggest they upload a CSV bank export so you can give specific insights.]`;
      }
    }

    const ollamaMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...claudeMessages,
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Ollama error:', errText);
      return NextResponse.json(
        { error: 'Failed to connect to Ollama. Make sure it is running.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.message?.content || '';

    // Extract plan if present
    let plan = null;
    const planMatch = assistantMessage.match(/<plan>([\s\S]*?)<\/plan>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1]);
      } catch {
        // Plan parsing failed — not critical
      }
    }

    // Clean the message (remove plan tags from visible text)
    const cleanMessage = assistantMessage.replace(/<plan>[\s\S]*?<\/plan>/, '').trim();

    return NextResponse.json({
      message: cleanMessage,
      plan,
      turn: turn + 1,
    });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: 'Failed to get response. Make sure Ollama is running (ollama serve).' },
      { status: 500 }
    );
  }
}
