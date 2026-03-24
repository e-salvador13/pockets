/**
 * CashPilot CSV Parser
 * Auto-detects Wells Fargo format (no headers, 5 columns) and generic CSV with headers.
 */

export interface RawTransaction {
  date: string;        // ISO string
  amount: number;      // positive = income, negative = expense
  description: string;
  checkNumber?: string;
  source: 'wells-fargo' | 'generic';
}

interface ParseResult {
  transactions: RawTransaction[];
  format: 'wells-fargo' | 'generic';
  errors: string[];
}

/**
 * Parse a CSV string into normalized transactions
 */
export function parseCSV(csvText: string): ParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { transactions: [], format: 'generic', errors: ['Empty CSV file'] };
  }

  // Detect format
  const format = detectFormat(lines);

  if (format === 'wells-fargo') {
    return parseWellsFargo(lines);
  }

  return parseGeneric(lines);
}

/**
 * Detect if CSV is Wells Fargo format (no headers, 5 columns, col C is *)
 */
function detectFormat(lines: string[]): 'wells-fargo' | 'generic' {
  // Check first few data lines
  const samplesToCheck = Math.min(5, lines.length);
  let wellsFargoScore = 0;

  for (let i = 0; i < samplesToCheck; i++) {
    const fields = parseCSVLine(lines[i]);

    // Wells Fargo: 5 columns, col C is *, col A looks like MM/DD/YYYY
    if (fields.length >= 4) {
      const dateMatch = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fields[0].trim());
      const hasAsterisk = fields[2]?.trim() === '*';
      const amountLooksNumeric = /^-?\d+\.?\d*$/.test(fields[1].trim());

      if (dateMatch && amountLooksNumeric && hasAsterisk) {
        wellsFargoScore++;
      }
      // Also handle Wells Fargo without asterisk (some exports)
      if (dateMatch && amountLooksNumeric && fields.length === 5) {
        wellsFargoScore += 0.5;
      }
    }
  }

  // If first line looks like a header, it's generic
  const firstFields = parseCSVLine(lines[0]);
  const looksLikeHeader = firstFields.some(f =>
    /^(date|amount|description|transaction|category|type|memo|credit|debit)/i.test(f.trim())
  );

  if (looksLikeHeader) return 'generic';
  if (wellsFargoScore >= samplesToCheck * 0.5) return 'wells-fargo';

  // Default to generic
  return 'generic';
}

/**
 * Parse Wells Fargo CSV (no headers)
 * Columns: Date, Amount, *, Check#, Description
 */
function parseWellsFargo(lines: string[]): ParseResult {
  const transactions: RawTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const fields = parseCSVLine(lines[i]);

      if (fields.length < 4) {
        errors.push(`Line ${i + 1}: Expected at least 4 columns, got ${fields.length}`);
        continue;
      }

      const dateStr = fields[0].trim();
      const amountStr = fields[1].trim();
      const description = (fields[4] || fields[3] || '').trim();
      const checkNumber = fields[3]?.trim() || undefined;

      // Parse date (MM/DD/YYYY)
      const date = parseDateMMDDYYYY(dateStr);
      if (!date) {
        errors.push(`Line ${i + 1}: Invalid date "${dateStr}"`);
        continue;
      }

      // Parse amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) {
        errors.push(`Line ${i + 1}: Invalid amount "${amountStr}"`);
        continue;
      }

      transactions.push({
        date: date.toISOString(),
        amount,
        description: cleanDescription(description),
        checkNumber: checkNumber && checkNumber !== '*' ? checkNumber : undefined,
        source: 'wells-fargo',
      });
    } catch (err) {
      errors.push(`Line ${i + 1}: Parse error`);
    }
  }

  return { transactions, format: 'wells-fargo', errors };
}

/**
 * Parse generic CSV with headers
 * Tries to find Date, Amount/Debit/Credit, Description columns
 */
function parseGeneric(lines: string[]): ParseResult {
  const transactions: RawTransaction[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    return { transactions, format: 'generic', errors: ['CSV has no data rows'] };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  // Find column indices
  const dateIdx = headers.findIndex(h =>
    /^(date|transaction.?date|posted.?date|post.?date)$/i.test(h)
  );
  const amountIdx = headers.findIndex(h =>
    /^(amount|transaction.?amount)$/i.test(h)
  );
  const debitIdx = headers.findIndex(h => /^(debit|withdrawal)$/i.test(h));
  const creditIdx = headers.findIndex(h => /^(credit|deposit)$/i.test(h));
  const descIdx = headers.findIndex(h =>
    /^(description|memo|merchant|payee|transaction.?description|name)$/i.test(h)
  );

  if (dateIdx === -1) {
    errors.push('Could not find Date column');
    return { transactions, format: 'generic', errors };
  }
  if (amountIdx === -1 && debitIdx === -1) {
    errors.push('Could not find Amount or Debit/Credit columns');
    return { transactions, format: 'generic', errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCSVLine(lines[i]);
      if (fields.length < 2) continue;

      const dateStr = fields[dateIdx]?.trim();
      const date = parseFlexibleDate(dateStr);
      if (!date) {
        errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
        continue;
      }

      let amount: number;
      if (amountIdx !== -1) {
        amount = parseAmount(fields[amountIdx]?.trim());
      } else {
        // Separate debit/credit columns
        const debit = debitIdx !== -1 ? parseAmount(fields[debitIdx]?.trim()) : 0;
        const credit = creditIdx !== -1 ? parseAmount(fields[creditIdx]?.trim()) : 0;
        amount = credit - Math.abs(debit);
      }

      if (isNaN(amount)) {
        errors.push(`Row ${i + 1}: Invalid amount`);
        continue;
      }

      const description = descIdx !== -1 ? fields[descIdx]?.trim() : 'Unknown';

      transactions.push({
        date: date.toISOString(),
        amount,
        description: cleanDescription(description || 'Unknown'),
        source: 'generic',
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  return { transactions, format: 'generic', errors };
}

/* ───── Helpers ───── */

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

function parseDateMMDDYYYY(str: string): Date | null {
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

function parseFlexibleDate(str: string): Date | null {
  if (!str) return null;

  // Try MM/DD/YYYY
  const d1 = parseDateMMDDYYYY(str);
  if (d1) return d1;

  // Try YYYY-MM-DD
  const match2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match2) {
    const date = new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  // Try MM-DD-YYYY
  const match3 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match3) {
    const date = new Date(parseInt(match3[3]), parseInt(match3[1]) - 1, parseInt(match3[2]));
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback: let Date.parse try
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmount(str: string): number {
  if (!str) return 0;
  // Remove $, commas, spaces
  const cleaned = str.replace(/[$,\s]/g, '');
  // Handle parentheses as negative: (123.45) => -123.45
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1));
  }
  return parseFloat(cleaned);
}

function cleanDescription(desc: string): string {
  // Remove extra whitespace
  return desc.replace(/\s+/g, ' ').trim();
}
