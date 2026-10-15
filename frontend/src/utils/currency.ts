/**
 * Centralized Indian Rupee (INR / ₹) Currency Formatter
 * Complies with Indian numbering system (Lakhs, Crores, e.g. ₹1,25,000, ₹12,50,000).
 */

export interface FormatINROptions {
  compact?: boolean;
  showDecimals?: boolean;
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
}

/**
 * Formats a numerical amount into Indian Rupee (INR / ₹) standard representation.
 * Examples:
 *   formatINR(1500)      => "₹1,500"
 *   formatINR(25000)     => "₹25,000"
 *   formatINR(125000)    => "₹1,25,000"
 *   formatINR(1250000)   => "₹12,50,000"
 *   formatINR(7200000)   => "₹72,00,000"
 */
export function formatINR(amount: number, options: FormatINROptions = {}): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }

  const { compact = false, showDecimals = false, signDisplay = 'auto' } = options;

  if (compact) {
    return formatCompactINR(amount);
  }

  try {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: showDecimals ? 2 : 0,
      minimumFractionDigits: showDecimals ? 2 : 0,
      signDisplay,
    });
    return formatter.format(amount);
  } catch {
    // Robust fallback if Intl is constrained
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : (signDisplay === 'always' && amount > 0 ? '+' : '');
    return `${sign}₹${abs.toLocaleString('en-IN')}`;
  }
}

/**
 * Compact Indian numbering representation for dense headers and KPI cards.
 * Examples:
 *   formatCompactINR(25000)   => "₹25K"
 *   formatCompactINR(125000)  => "₹1.25L"
 *   formatCompactINR(7200000) => "₹72L"
 *   formatCompactINR(15000000)=> "₹1.5Cr"
 */
export function formatCompactINR(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }

  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 10000000) {
    const cr = abs / 10000000;
    return `${sign}₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    const lakh = abs / 100000;
    return `${sign}₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }

  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

/**
 * Replaces or safely formats monetary diff strings (e.g. +₹25,000 or -₹1,85,000)
 */
export function formatINRExtended(amount: number, prefix: '+' | '-' | '' = ''): string {
  if (amount === 0) return '₹0';
  const formatted = formatINR(Math.abs(amount));
  if (amount > 0 && prefix === '+') return `+${formatted}`;
  if (amount < 0 || prefix === '-') return `-${formatted}`;
  return formatted;
}
