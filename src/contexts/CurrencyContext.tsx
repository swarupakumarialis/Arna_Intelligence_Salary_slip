import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  CurrencyCode, CURRENCY_META, CURRENCY_CODES, ExchangeRates,
  convertAmount, convertAndFormat, resolveExchangeRates,
} from '../utils/currencyService';

export type { CurrencyCode, ExchangeRates };
export { CURRENCY_META, CURRENCY_CODES };

interface CurrencyContextValue {
  /** Currency the app is currently *displaying* amounts in. */
  currency: CurrencyCode;
  /** Currency payroll amounts are actually calculated/stored in — INR
      by default. Changing this is a Company Settings action, not a
      display toggle; see companySettingsStore.ts. */
  baseCurrency: CurrencyCode;
  /** Manually-maintained rates, each "1 unit of this currency = N units
      of baseCurrency" (e.g. { USD: 96 } when base is INR). */
  exchangeRates: ExchangeRates;
  setCurrency: (c: CurrencyCode) => void;
  /** Converts a base-currency amount to the currently selected display
      currency, without formatting — for callers that need the raw
      number (e.g. the payslip's amount-in-words line). */
  convert: (amountInBase: number) => number;
  /** Converts *and* formats a base-currency amount for display — the
      one function most screens actually call. */
  format: (amountInBase: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface ProviderProps {
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRates;
  onCurrencyChange: (c: CurrencyCode) => void;
  children: React.ReactNode;
}

/**
 * App-wide currency display — the one place a base-currency amount is
 * converted + formatted for the screen, backed entirely by
 * utils/currencyService.ts (no conversion/formatting logic lives here
 * or anywhere else — see that file for the reusable implementation).
 * Every payroll number in this app (SalaryItem.amount, SalaryHistoryRecord
 * totals, etc.) is always calculated and persisted in `baseCurrency`;
 * this context never touches that — it only decides how the number is
 * *displayed*, including on the Live Preview and exported PDF.
 *
 * currency/baseCurrency/exchangeRates are owned by App.tsx and backed
 * by BrandConfig, so the top-nav quick switcher and Company Settings'
 * Currency tab both read/write the exact same persisted value.
 */
export function CurrencyProvider({ currency, baseCurrency, exchangeRates, onCurrencyChange, children }: ProviderProps) {
  const rates = useMemo(() => resolveExchangeRates(exchangeRates), [exchangeRates]);

  const convert = useCallback(
    (amountInBase: number) => convertAmount(amountInBase, currency, baseCurrency, rates),
    [currency, baseCurrency, rates]
  );

  const format = useCallback(
    (amountInBase: number) => convertAndFormat(amountInBase, currency, baseCurrency, rates),
    [currency, baseCurrency, rates]
  );

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    baseCurrency,
    exchangeRates: rates,
    setCurrency: onCurrencyChange,
    convert,
    format,
  }), [currency, baseCurrency, rates, onCurrencyChange, convert, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
