import React, { createContext, useCallback, useContext, useMemo } from 'react';

export type CurrencyCode = 'INR' | 'USD';

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; locale: string; label: string }> = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'Indian Rupee' },
  USD: { symbol: '$', locale: 'en-US', label: 'US Dollar' },
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  /** 1 USD = exchangeRate INR (e.g. 86). */
  exchangeRate: number;
  setCurrency: (c: CurrencyCode) => void;
  setExchangeRate: (r: number) => void;
  /** Formats an amount that is always calculated and stored in INR —
      payroll math never changes, this only decides how the number
      is *displayed*. */
  format: (amountInInr: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface ProviderProps {
  currency: CurrencyCode;
  exchangeRate: number;
  onCurrencyChange: (c: CurrencyCode) => void;
  onExchangeRateChange: (r: number) => void;
  children: React.ReactNode;
}

/**
 * App-wide currency display — the one place an INR amount is
 * converted + formatted for the screen. Every payroll number in this
 * app (SalaryItem.amount, SalaryHistoryRecord totals, etc.) is always
 * calculated and persisted in INR; this context never touches that —
 * it just multiplies by 1/exchangeRate for display when the selected
 * currency is USD, then formats via Intl.NumberFormat.
 *
 * currency/exchangeRate are owned by App.tsx and backed by
 * BrandConfig.defaultCurrency / BrandConfig.exchangeRate, so the
 * top-nav quick switcher and Company Settings' Currency tab both
 * read/write the exact same persisted value — there's no separate
 * "session" currency to fall out of sync.
 *
 * Deliberately NOT used by SalarySlipPreview.tsx or components/pdf/**:
 * the payslip itself is the authoritative payroll record and always
 * shows real INR, regardless of what the rest of the app is displaying.
 */
export function CurrencyProvider({ currency, exchangeRate, onCurrencyChange, onExchangeRateChange, children }: ProviderProps) {
  const format = useCallback((amountInInr: number): string => {
    const rate = exchangeRate > 0 ? exchangeRate : 1;
    const converted = currency === 'USD' ? amountInInr / rate : amountInInr;
    const meta = CURRENCY_META[currency];
    try {
      return new Intl.NumberFormat(meta.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'USD' ? 2 : 0,
        maximumFractionDigits: currency === 'USD' ? 2 : 0,
      }).format(converted);
    } catch {
      return `${meta.symbol}${converted.toFixed(2)}`;
    }
  }, [currency, exchangeRate]);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    exchangeRate,
    setCurrency: onCurrencyChange,
    setExchangeRate: onExchangeRateChange,
    format,
  }), [currency, exchangeRate, onCurrencyChange, onExchangeRateChange, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
