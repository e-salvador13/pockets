/**
 * CashPilot Transaction Categorizer
 * Rule-based categorization with keyword matching.
 */

export type Category =
  | 'Grocery'
  | 'Dining'
  | 'Gas'
  | 'Subscriptions'
  | 'Transport'
  | 'Utilities'
  | 'Housing'
  | 'Income'
  | 'Shopping'
  | 'Health'
  | 'Transfer'
  | 'Entertainment'
  | 'Insurance'
  | 'Education'
  | 'Other';

interface CategoryRule {
  category: Category;
  keywords: string[];
  /** If true, only match income transactions (amount > 0) */
  incomeOnly?: boolean;
  /** If true, only match expense transactions (amount < 0) */
  expenseOnly?: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Income',
    keywords: [
      'payroll', 'direct dep', 'direct deposit', 'salary', 'wages',
      'zelle from', 'zelle received', 'venmo cashout', 'venmo from',
      'tax refund', 'irs treas', 'interest payment', 'dividend',
      'cash deposit', 'mobile deposit',
    ],
    incomeOnly: true,
  },
  {
    category: 'Transfer',
    keywords: [
      'transfer', 'zelle to', 'zelle sent', 'venmo to', 'venmo sent',
      'wire', 'ach', 'online transfer', 'brokerage', 'investment',
      'savings', 'wealthfront', 'betterment', 'robinhood', 'fidelity',
      'vanguard', 'schwab', 'coinbase', 'crypto',
    ],
  },
  {
    category: 'Housing',
    keywords: [
      'rent', 'mortgage', 'property tax', 'property mgt', 'hoa',
      'homeowner', 'apartment', 'lease', 'landlord', 'zillow',
      'realtor', 'home depot', 'lowes', "lowe's",
    ],
  },
  {
    category: 'Grocery',
    keywords: [
      'walmart', 'wal-mart', 'kroger', 'publix', 'trader joe',
      'whole foods', 'wholefoods', 'aldi', 'costco', 'sam\'s club',
      'sams club', 'safeway', 'albertson', 'food lion', 'piggly',
      'wegmans', 'sprouts', 'h-e-b', 'heb ', 'market basket',
      'stop & shop', 'stop and shop', 'giant food', 'giant eagle',
      'winco', 'fresh market', 'grocery', 'instacart',
      'harris teeter', 'meijer', 'food', 'supermarket',
    ],
    expenseOnly: true,
  },
  {
    category: 'Dining',
    keywords: [
      'doordash', 'uber eat', 'ubereats', 'grubhub', 'postmates',
      'chipotle', 'starbucks', 'mcdonald', 'chick-fil-a', 'chickfila',
      'taco bell', 'wendy', 'burger king', 'subway', 'panera',
      'dunkin', 'domino', 'pizza hut', 'papa john', 'olive garden',
      'applebee', 'chili\'s', 'ihop', 'waffle house', 'denny',
      'five guys', 'popeye', 'panda express', 'wingstop',
      'buffalo wild', 'restaurant', 'cafe', 'coffee', 'diner',
      'kitchen', 'grill', 'sushi', 'thai', 'mexican',
      'italian', 'chinese', 'bakery', 'bar ', 'brew',
      'toast tab', 'square meal', 'seamless',
    ],
    expenseOnly: true,
  },
  {
    category: 'Gas',
    keywords: [
      'shell', 'exxon', 'exxonmobil', 'bp ', 'chevron', 'wawa',
      'speedway', 'marathon', 'sunoco', 'citgo', 'valero',
      'phillips 66', 'conoco', 'murphy', 'racetrac', 'quiktrip',
      'qt ', 'sheetz', 'casey', 'pilot', 'fuel', 'gasoline',
      'petrol', 'gas station',
    ],
    expenseOnly: true,
  },
  {
    category: 'Subscriptions',
    keywords: [
      'netflix', 'spotify', 'hulu', 'amazon prime', 'disney+',
      'disney plus', 'hbo', 'youtube', 'apple.com', 'apple music',
      'icloud', 'google storage', 'google one', 'dropbox',
      'adobe', 'microsoft', 'office 365', 'linkedin prem',
      'chatgpt', 'openai', 'github', 'notion', 'slack',
      'zoom', 'paramount', 'peacock', 'audible', 'kindle',
      'crunchyroll', 'twitch', 'patreon', 'substack',
      'new york times', 'nytimes', 'washington post', 'wsj',
      'wall street journal', 'annual', 'monthly fee',
      'recurring', 'membership',
    ],
    expenseOnly: true,
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'lyft', 'parking', 'toll', 'metro', 'transit',
      'bus ', 'train ', 'subway', 'amtrak', 'airline', 'flight',
      'delta', 'united air', 'american air', 'southwest',
      'jetblue', 'spirit air', 'frontier air', 'car wash',
      'jiffy lube', 'autozone', 'o\'reilly', 'advance auto',
      'tire', 'car payment', 'auto loan', 'dmv',
    ],
    expenseOnly: true,
  },
  {
    category: 'Utilities',
    keywords: [
      'electric', 'power', 'water', 'sewer', 'gas bill',
      'internet', 'comcast', 'xfinity', 'verizon', 'att ',
      'at&t', 't-mobile', 'tmobile', 'sprint', 'mint mobile',
      'visible', 'spectrum', 'cox ', 'frontier comm',
      'google fi', 'utility', 'energy', 'dominion',
      'duke energy', 'pgande', 'pg&e', 'conedison',
    ],
    expenseOnly: true,
  },
  {
    category: 'Health',
    keywords: [
      'pharmacy', 'cvs', 'walgreens', 'rite aid', 'doctor',
      'hospital', 'medical', 'clinic', 'dental', 'dentist',
      'optom', 'vision', 'therapy', 'counseling', 'urgent care',
      'labcorp', 'quest diag', 'health', 'gym', 'fitness',
      'planet fitness', 'anytime fitness', 'equinox', 'crossfit',
      'yoga', 'peloton', 'insurance prem',
    ],
    expenseOnly: true,
  },
  {
    category: 'Insurance',
    keywords: [
      'geico', 'state farm', 'allstate', 'progressive',
      'liberty mutual', 'usaa', 'nationwide', 'farmers',
      'insurance', 'premium', 'life ins', 'auto ins',
      'home ins', 'renters ins',
    ],
    expenseOnly: true,
  },
  {
    category: 'Entertainment',
    keywords: [
      'amc', 'regal', 'cinema', 'movie', 'concert',
      'ticketmaster', 'stubhub', 'seatgeek', 'eventbrite',
      'museum', 'zoo', 'aquarium', 'theme park', 'bowling',
      'arcade', 'steam', 'playstation', 'xbox', 'nintendo',
      'game', 'book', 'barnes',
    ],
    expenseOnly: true,
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'amzn', 'target', 'best buy', 'bestbuy',
      'apple store', 'macys', "macy's", 'nordstrom', 'zara',
      'h&m', 'gap ', 'old navy', 'marshall', 'tj maxx',
      'tjmaxx', 'ross ', 'burlington', 'nike', 'adidas',
      'foot locker', 'dick\'s sport', 'ikea', 'wayfair',
      'etsy', 'ebay', 'wish ', 'shein', 'walmart.com',
      'online purchase', 'retail',
    ],
    expenseOnly: true,
  },
  {
    category: 'Education',
    keywords: [
      'tuition', 'university', 'college', 'school',
      'student loan', 'navient', 'sallie mae', 'nelnet',
      'coursera', 'udemy', 'skillshare', 'masterclass',
      'textbook',
    ],
    expenseOnly: true,
  },
];

/**
 * Categorize a single transaction based on its description and amount.
 */
export function categorize(description: string, amount: number): Category {
  const descLower = description.toLowerCase();
  const isIncome = amount > 0;
  const isExpense = amount < 0;

  for (const rule of CATEGORY_RULES) {
    // Skip if income-only rule but transaction is expense
    if (rule.incomeOnly && !isIncome) continue;
    // Skip if expense-only rule but transaction is income
    if (rule.expenseOnly && !isExpense) continue;

    for (const keyword of rule.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }

  // Default: if it's income, categorize as Income
  if (isIncome) return 'Income';

  return 'Other';
}

/**
 * Categorize an array of transactions in bulk.
 */
export function categorizeAll(
  transactions: { description: string; amount: number }[]
): Category[] {
  return transactions.map(t => categorize(t.description, t.amount));
}

/**
 * Get icon name (lucide-react) for a category.
 */
export function getCategoryIcon(category: Category): string {
  const icons: Record<Category, string> = {
    Grocery: 'ShoppingCart',
    Dining: 'UtensilsCrossed',
    Gas: 'Fuel',
    Subscriptions: 'Repeat',
    Transport: 'Car',
    Utilities: 'Zap',
    Housing: 'Home',
    Income: 'TrendingUp',
    Shopping: 'ShoppingBag',
    Health: 'Heart',
    Transfer: 'ArrowLeftRight',
    Entertainment: 'Ticket',
    Insurance: 'Shield',
    Education: 'GraduationCap',
    Other: 'HelpCircle',
  };
  return icons[category];
}

/**
 * Get color for a category.
 */
export function getCategoryColor(category: Category): string {
  const colors: Record<Category, string> = {
    Grocery: '#4ADE80',
    Dining: '#FB923C',
    Gas: '#F87171',
    Subscriptions: '#A78BFA',
    Transport: '#38BDF8',
    Utilities: '#FBBF24',
    Housing: '#D4A853',
    Income: '#4ADE80',
    Shopping: '#F472B6',
    Health: '#F87171',
    Transfer: '#8888A0',
    Entertainment: '#C084FC',
    Insurance: '#94A3B8',
    Education: '#34D399',
    Other: '#6B7280',
  };
  return colors[category];
}
