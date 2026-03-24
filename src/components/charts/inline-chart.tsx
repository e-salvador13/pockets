'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  data: Record<string, string | number>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#4ADE80', '#38BDF8', '#A78BFA', '#FB923C', '#F87171',
  '#FBBF24', '#F472B6', '#34D399', '#D4A853', '#C084FC',
];

const CHART_THEME = {
  background: '#1A1A24',
  grid: '#2A2A3A',
  text: '#8888A0',
  tooltipBg: '#0A0A0F',
  tooltipBorder: '#2A2A3A',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: CHART_THEME.tooltipBg,
        border: `1px solid ${CHART_THEME.tooltipBorder}`,
        borderRadius: '12px',
        padding: '12px 16px',
      }}
    >
      {label && (
        <p style={{ color: '#FFFFFF', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, fontSize: '13px', fontWeight: 600 }}>
          ${typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : entry.value}
        </p>
      ))}
    </div>
  );
}

export function InlineChart({ spec }: { spec: ChartSpec }) {
  const { type, title, data, xKey = 'name', yKey = 'value', color = '#4ADE80', colors } = spec;

  const chartColors = colors || DEFAULT_COLORS;

  return (
    <div
      style={{
        background: CHART_THEME.background,
        borderRadius: '12px',
        padding: '20px',
        marginTop: '12px',
        marginBottom: '8px',
        border: `1px solid ${CHART_THEME.grid}`,
      }}
    >
      {title && (
        <h4
          style={{
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '16px',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h4>
      )}

      <ResponsiveContainer width="100%" height={220}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_THEME.text, fontSize: 11 }}
              axisLine={{ stroke: CHART_THEME.grid }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_THEME.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={chartColors[index % chartColors.length]} />
              ))}
            </Bar>
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_THEME.text, fontSize: 11 }}
              axisLine={{ stroke: CHART_THEME.grid }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_THEME.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4, strokeWidth: 0 }}
              activeDot={{ fill: color, r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey={yKey}
              nameKey={xKey}
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span style={{ color: CHART_THEME.text, fontSize: '11px' }}>{value}</span>
              )}
            />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Parse chart specs from AI response text.
 * Looks for ```chart ... ``` blocks.
 */
export function parseChartBlocks(text: string): { parts: (string | ChartSpec)[]; hasCharts: boolean } {
  const parts: (string | ChartSpec)[] = [];
  const chartRegex = /```chart\s*\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasCharts = false;

  while ((match = chartRegex.exec(text)) !== null) {
    // Add text before the chart
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) parts.push(textBefore);
    }

    // Try to parse chart JSON
    try {
      const chartSpec = JSON.parse(match[1]) as ChartSpec;
      if (chartSpec.type && chartSpec.data) {
        parts.push(chartSpec);
        hasCharts = true;
      } else {
        parts.push(match[0]); // Failed to parse, keep as text
      }
    } catch {
      parts.push(match[0]); // Failed to parse, keep as text
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) parts.push(remaining);
  }

  // If no chart blocks found, return original text
  if (parts.length === 0 && text.trim()) {
    parts.push(text.trim());
  }

  return { parts, hasCharts };
}
