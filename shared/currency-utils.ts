/**
 * Currency conversion utilities for dual currency display (USD/LBP)
 */

export interface CurrencyDisplayOptions {
  showBoth?: boolean;
  upRoundLBP?: boolean;
  showSymbols?: boolean;
}

export interface CurrencyAmount {
  usd: number;
  lbp: number;
  rate: number;
}

/**
 * Convert USD amount to LBP using the current exchange rate
 * When upRound is true, rounds up to the nearest 5000 LBP
 */
export function convertUsdToLbp(usdAmount: number, rate: number, upRound: boolean = true): number {
  const lbpAmount = usdAmount * rate;
  
  if (upRound) {
    // Round up to the nearest 5000
    return Math.ceil(lbpAmount / 5000) * 5000;
  } else {
    return Math.round(lbpAmount);
  }
}

/**
 * Convert LBP amount to USD using the current exchange rate
 */
export function convertLbpToUsd(lbpAmount: number, rate: number): number {
  return Math.round((lbpAmount / rate) * 100) / 100; // Round to 2 decimal places
}

/**
 * Format currency amount for display
 */
export function formatCurrencyAmount(
  amount: number,
  currency: 'USD' | 'LBP',
  options: CurrencyDisplayOptions = {}
): string {
  const { showSymbols = true } = options;
  
  if (currency === 'USD') {
    const formatted = amount.toFixed(2);
    return showSymbols ? `$${formatted}` : formatted;
  } else {
    // LBP - format with thousands separator and no decimals (already rounded to nearest 5000)
    const formatted = Math.round(amount).toLocaleString();
    return showSymbols ? `${formatted} LBP` : formatted;
  }
}

/**
 * Format dual currency display for menus and receipts
 */
export function formatDualCurrency(
  usdAmount: number,
  rate: number,
  options: CurrencyDisplayOptions = {}
): string {
  const { showBoth = true, upRoundLBP = true, showSymbols = true } = options;
  
  const lbpAmount = convertUsdToLbp(usdAmount, rate, upRoundLBP);
  
  if (!showBoth) {
    return formatCurrencyAmount(usdAmount, 'USD', { showSymbols });
  }
  
  const usdDisplay = formatCurrencyAmount(usdAmount, 'USD', { showSymbols });
  const lbpDisplay = formatCurrencyAmount(lbpAmount, 'LBP', { showSymbols });
  
  return `${usdDisplay} (${lbpDisplay})`;
}

/**
 * Calculate currency amounts from USD base price
 */
export function calculateCurrencyAmounts(usdPrice: number, exchangeRate: number): CurrencyAmount {
  return {
    usd: usdPrice,
    lbp: convertUsdToLbp(usdPrice, exchangeRate, true),
    rate: exchangeRate,
  };
}

/**
 * Validate exchange rate format
 */
export function validateExchangeRate(rate: string | number): { isValid: boolean; error?: string } {
  const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
  
  if (isNaN(numRate)) {
    return { isValid: false, error: 'Exchange rate must be a valid number' };
  }
  
  if (numRate <= 0) {
    return { isValid: false, error: 'Exchange rate must be greater than 0' };
  }
  
  if (numRate > 1000000) {
    return { isValid: false, error: 'Exchange rate seems unreasonably high' };
  }
  
  return { isValid: true };
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(currency: 'USD' | 'LBP'): string {
  return currency === 'USD' ? '$' : 'LBP';
}

/**
 * Parse price input that might be in either currency
 */
export function parsePriceInput(
  input: string,
  exchangeRate: number,
  targetCurrency: 'USD' | 'LBP' = 'USD'
): { amount: number; currency: 'USD' | 'LBP' } {
  // Remove currency symbols and whitespace
  const cleaned = input.replace(/[$₤,\s]/g, '');
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) {
    throw new Error('Invalid price format');
  }
  
  // Detect currency based on magnitude (simple heuristic)
  // If amount is > 1000, assume it's LBP, otherwise USD
  const detectedCurrency = amount > 1000 ? 'LBP' : 'USD';
  
  if (targetCurrency === detectedCurrency) {
    return { amount, currency: detectedCurrency };
  } else if (targetCurrency === 'USD' && detectedCurrency === 'LBP') {
    return { amount: convertLbpToUsd(amount, exchangeRate), currency: 'USD' };
  } else {
    return { amount: convertUsdToLbp(amount, exchangeRate, false), currency: 'LBP' };
  }
}