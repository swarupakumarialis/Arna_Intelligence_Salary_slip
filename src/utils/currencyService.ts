import { toWords } from 'number-to-words';

/**
 * The one reusable currency service for the whole app — every place
 * that converts or formats a monetary amount (CurrencyContext, the
 * Salary Generator's live preview, the exported PDF, Company Settings)
 * goes through the functions here instead of re-implementing
 * conversion/formatting locally. Payroll itself is always calculated
 * and stored in the configured *base* currency (INR by default) —
 * nothing here changes that; these are purely display-time helpers.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'AUD' | 'CAD' | 'SGD';

export interface CurrencyMeta {
  symbol: string;
  locale: string;
  label: string;
  /** Used by amountToWords, e.g. "Rupees" / "Dollars". */
  wordsMajor: string;
  /** Used by amountToWords for the fractional part, e.g. "Paise" / "Cents". */
  wordsMinor: string;
}

export const CURRENCY_CODES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'];

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'Indian Rupee',      wordsMajor: 'Rupees',  wordsMinor: 'Paise' },
  USD: { symbol: '$', locale: 'en-US', label: 'US Dollar',         wordsMajor: 'Dollars', wordsMinor: 'Cents' },
  EUR: { symbol: '€', locale: 'en-IE', label: 'Euro',              wordsMajor: 'Euros',   wordsMinor: 'Cents' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'British Pound',     wordsMajor: 'Pounds',  wordsMinor: 'Pence' },
  AED: { symbol: 'AED', locale: 'en-AE', label: 'UAE Dirham',      wordsMajor: 'Dirhams', wordsMinor: 'Fils' },
  AUD: { symbol: 'A$', locale: 'en-AU', label: 'Australian Dollar', wordsMajor: 'Dollars', wordsMinor: 'Cents' },
  CAD: { symbol: 'C$', locale: 'en-CA', label: 'Canadian Dollar',  wordsMajor: 'Dollars', wordsMinor: 'Cents' },
  SGD: { symbol: 'S$', locale: 'en-SG', label: 'Singapore Dollar', wordsMajor: 'Dollars', wordsMinor: 'Cents' },
};

/**
 * Each entry = how many units of the configured BASE currency equal 1
 * unit of that currency — e.g. base=INR, `{ USD: 96 }` means
 * "1 USD = 96 INR". The base currency is never a key in this map; its
 * own rate is always implicitly 1. Manually maintained today (see
 * resolveExchangeRates below); this shape is what a future live-rate
 * API would also need to produce.
 */
export type ExchangeRates = Partial<Record<CurrencyCode, number>>;

/** Converts an amount denominated in `baseCurrency` into `targetCurrency`.
    Falls back to the base amount unconverted if no rate is configured
    yet for the target, rather than showing a misleading number. */
export function convertAmount(
  amountInBase: number,
  targetCurrency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): number {
  if (targetCurrency === baseCurrency) return amountInBase;
  const rate = rates[targetCurrency];
  if (!rate || rate <= 0) return amountInBase;
  return amountInBase / rate;
}

/** Formats an amount (already in the target currency, i.e. already
    converted) using Intl.NumberFormat, with a manual symbol fallback
    for locales/currencies a given browser's Intl data doesn't cover. */
export function formatAmount(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCY_META[currency];
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'INR' ? 0 : 2,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${meta.symbol}${amount.toFixed(2)}`;
  }
}

/** The one function most call sites actually want: convert + format in
    one step, straight from a base-currency amount. */
export function convertAndFormat(
  amountInBase: number,
  targetCurrency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): string {
  return formatAmount(convertAmount(amountInBase, targetCurrency, baseCurrency, rates), targetCurrency);
}

/** Spells out an amount (already converted to `currency`) as words for
    the payslip's "Amount in Words" line, e.g. "Fifty Thousand Rupees
    Only" / "Six Hundred Two Dollars and Fifty Cents Only". */
export function amountToWords(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCY_META[currency];
  if (amount <= 0) return `Zero ${meta.wordsMajor} Only`;

  const integerPart = Math.floor(amount);
  const fractionalPart = Math.round((amount - integerPart) * 100);

  let words = toWords(integerPart).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ` ${meta.wordsMajor}`;
  if (fractionalPart > 0) {
    words += ' and ' + toWords(fractionalPart).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ` ${meta.wordsMinor}`;
  }
  return words + ' Only';
}

/**
 * Future-ready seam (per spec): every consumer of exchange rates goes
 * through this one function rather than reading BrandConfig.exchangeRates
 * directly. Today it's a trivial passthrough of the manually-entered
 * rates; swapping in a live rate-API provider later means changing the
 * body of this one function (e.g. to fetch/cache from a provider,
 * falling back to the manual rates if the API is unreachable) — no
 * caller anywhere else in the app needs to change.
 */
export function resolveExchangeRates(manualRates: ExchangeRates): ExchangeRates {
  return manualRates;
}
