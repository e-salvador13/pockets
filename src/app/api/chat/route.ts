/**
 * CashPilot Chat API
 * Connects to Ollama (llama3) with personalized financial context.
 * Streams responses via ReadableStream.
 */

import { NextRequest } from 'next/server';

const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'llama3';

interface ChatRequestBody {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: {
    user: {
      name: string;
      personality: string;
      primaryGoal: string;
      checkingFloor: number;
      monthlyInvest: number;
      takeHomeIncome: number;
    };
    snapshot: {
      earned: number;
      spent: number;
      flexible: number;
      month: string;
    };
    categoryBreakdown: {
      category: string;
      total: number;
      count: number;
      percentage: number;
    }[];
    recurring: {
      description: string;
      amount: number;
      frequency: string;
    }[];
    transactionCount: number;
  };
}

function buildSystemPrompt(context: ChatRequestBody['context']): string {
  const { user, snapshot, categoryBreakdown, recurring, transactionCount } = context;

  const categoryLines = categoryBreakdown
    .slice(0, 10)
    .map(c => `  - ${c.category}: $${c.total.toFixed(2)} (${c.count} transactions, ${c.percentage}%)`)
    .join('\n');

  const recurringLines = recurring
    .slice(0, 8)
    .map(r => `  - ${r.description}: $${r.amount.toFixed(2)} (${r.frequency})`)
    .join('\n');

  const personalitySection = user.personality
    ? `\nCOMMUNICATION STYLE:\n${user.personality}\nAdapt your tone and language to match this preference.\n`
    : '';

  return `You are CashPilot, an AI personal finance assistant. You help ${user.name || 'the user'} understand their money and make smarter decisions.

${personalitySection}
USER GOALS:
- Primary goal: ${user.primaryGoal || 'Financial clarity'}
- Checking account floor: $${user.checkingFloor.toLocaleString()}
- Monthly investment target: $${user.monthlyInvest.toLocaleString()}
- Take-home income: $${user.takeHomeIncome.toLocaleString()}/month

CURRENT MONTH SNAPSHOT (${snapshot.month}):
- Earned: $${snapshot.earned.toFixed(2)}
- Spent: $${snapshot.spent.toFixed(2)}
- Flexible (after goals): $${snapshot.flexible.toFixed(2)}
- Total transactions analyzed: ${transactionCount}

SPENDING BY CATEGORY THIS MONTH:
${categoryLines || '  No spending data available yet.'}

RECURRING CHARGES DETECTED:
${recurringLines || '  None detected yet.'}

RULES:
1. Be concise but helpful. Give specific numbers when available.
2. Reference actual transaction data when answering questions about spending.
3. When the user asks about budgets or spending patterns, use the category breakdown.
4. When suggesting whether they can afford something, consider their floor, investment target, and flexible money.
5. Never use emojis. Use clean, professional language.
6. If asked to show a chart or visualization, include a chart specification in your response using a fenced code block with the language tag "chart". The chart spec is JSON:
   \`\`\`chart
   {
     "type": "bar" | "line" | "pie",
     "title": "Chart Title",
     "data": [{ "name": "Label", "value": 123 }, ...],
     "xKey": "name",
     "yKey": "value",
     "color": "#4ADE80"
   }
   \`\`\`
7. When providing charts, also include a brief text summary before or after the chart block.
8. If asked about trends over time, use a line chart. For comparisons, use a bar chart. For breakdowns, use a pie chart.
9. Always be encouraging but honest about financial reality.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, history, context } = body;

    const systemPrompt = buildSystemPrompt(context);

    // Build messages array for Ollama
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Call Ollama API with streaming
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 1024,
        },
      }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error('Ollama error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to connect to Ollama. Make sure Ollama is running with llama3 model.',
          details: errorText,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response
    const reader = ollamaResponse.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: 'No response body from Ollama' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // Ollama streams newline-delimited JSON
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  // Send as SSE-like format
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: json.message.content })}\n\n`)
                  );
                }
                if (json.done) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
