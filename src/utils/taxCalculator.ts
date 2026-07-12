import { TaxConfig } from '../types';

/** Preset tax-regime configs (India old/new, USA, UK, UAE, Custom).
    Only defaultTaxConfigs[0] is actually consumed today (App.tsx's
    fixedTaxConfig, passed through to the payslip preview/PDF as
    static reference data) — the calculation engine and custom-config
    builder UI that used to read the rest of this list were removed as
    unused (production-readiness cleanup): they had zero live callers,
    so nothing about how a payslip is generated changes here. */
export const defaultTaxConfigs: TaxConfig[] = [
  {
    id: 'india-old',
    name: 'India - Old Regime',
    country: 'India',
    currency: 'INR',
    locale: 'en-IN',
    taxYear: 2026,
    isCustom: false,
    standardDeductions: [
      { id: 'sd-1', name: 'Standard Deduction', amount: 50000, type: 'fixed' }
    ],
    rules: [
      {
        id: 'pf',
        name: 'Employee Provident Fund (EPF)',
        type: 'percentage',
        rate: 12,
        baseOn: 'basic',
        isDeduction: true,
        isStatutory: true,
        description: '12% of Basic Salary',
        appliesTo: 'monthly'
      },
      {
        id: 'esi',
        name: 'Employee State Insurance (ESI)',
        type: 'percentage',
        rate: 0.75,
        minAmount: 0,
        maxAmount: 21000,
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: '0.75% of Gross Salary (if <= ₹21,000)',
        appliesTo: 'monthly'
      },
      {
        id: 'pt',
        name: 'Professional Tax',
        type: 'slab',
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: 'Varies by state (Maharashtra shown)',
        appliesTo: 'monthly',
        slabs: [
          { min: 0, max: 7500, rate: 0, fixedAmount: 0 },
          { min: 7501, max: 10000, rate: 0, fixedAmount: 175 },
          { min: 10001, max: null, rate: 0, fixedAmount: 200 }
        ]
      },
      {
        id: 'income-tax',
        name: 'Income Tax (TDS)',
        type: 'slab',
        baseOn: 'taxable',
        isDeduction: true,
        isStatutory: true,
        description: 'Monthly TDS as per old tax regime',
        appliesTo: 'annual',
        slabs: [
          { min: 0, max: 250000, rate: 0, fixedAmount: 0 },
          { min: 250001, max: 500000, rate: 5, fixedAmount: 0 },
          { min: 500001, max: 1000000, rate: 20, fixedAmount: 12500 },
          { min: 1000001, max: null, rate: 30, fixedAmount: 112500 }
        ]
      },
      {
        id: 'cess',
        name: 'Health & Education Cess',
        type: 'percentage',
        rate: 4,
        baseOn: 'tax',
        isDeduction: true,
        isStatutory: true,
        description: '4% of Income Tax',
        appliesTo: 'monthly'
      }
    ]
  },
  {
    id: 'india-new',
    name: 'India - New Regime',
    country: 'India',
    currency: 'INR',
    locale: 'en-IN',
    taxYear: 2026,
    isCustom: false,
    rules: [
      {
        id: 'pf',
        name: 'Employee Provident Fund (EPF)',
        type: 'percentage',
        rate: 12,
        baseOn: 'basic',
        isDeduction: true,
        isStatutory: true,
        description: '12% of Basic Salary',
        appliesTo: 'monthly'
      },
      {
        id: 'esi',
        name: 'Employee State Insurance (ESI)',
        type: 'percentage',
        rate: 0.75,
        minAmount: 0,
        maxAmount: 21000,
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: '0.75% of Gross Salary (if <= ₹21,000)',
        appliesTo: 'monthly'
      },
      {
        id: 'pt',
        name: 'Professional Tax',
        type: 'slab',
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: 'Varies by state (Maharashtra shown)',
        appliesTo: 'monthly',
        slabs: [
          { min: 0, max: 7500, rate: 0, fixedAmount: 0 },
          { min: 7501, max: 10000, rate: 0, fixedAmount: 175 },
          { min: 10001, max: null, rate: 0, fixedAmount: 200 }
        ]
      },
      {
        id: 'income-tax',
        name: 'Income Tax (TDS)',
        type: 'slab',
        baseOn: 'taxable',
        isDeduction: true,
        isStatutory: true,
        description: 'Monthly TDS as per new tax regime',
        appliesTo: 'annual',
        slabs: [
          { min: 0, max: 300000, rate: 0, fixedAmount: 0 },
          { min: 300001, max: 600000, rate: 5, fixedAmount: 0 },
          { min: 600001, max: 900000, rate: 10, fixedAmount: 15000 },
          { min: 900001, max: 1200000, rate: 15, fixedAmount: 45000 },
          { min: 1200001, max: 1500000, rate: 20, fixedAmount: 90000 },
          { min: 1500001, max: null, rate: 30, fixedAmount: 150000 }
        ]
      },
      {
        id: 'cess',
        name: 'Health & Education Cess',
        type: 'percentage',
        rate: 4,
        baseOn: 'tax',
        isDeduction: true,
        isStatutory: true,
        description: '4% of Income Tax',
        appliesTo: 'monthly'
      }
    ]
  },
  {
    id: 'usa',
    name: 'USA Federal',
    country: 'USA',
    currency: 'USD',
    locale: 'en-US',
    taxYear: 2026,
    isCustom: false,
    standardDeductions: [
      { id: 'sd-1', name: 'Standard Deduction (Single)', amount: 14600, type: 'fixed' }
    ],
    rules: [
      {
        id: 'social-security',
        name: 'Social Security',
        type: 'percentage',
        rate: 6.2,
        minAmount: 0,
        maxAmount: 160200,
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: '6.2% up to wage base limit',
        appliesTo: 'monthly'
      },
      {
        id: 'medicare',
        name: 'Medicare',
        type: 'percentage',
        rate: 1.45,
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: '1.45% of Gross Salary',
        appliesTo: 'monthly'
      },
      {
        id: 'federal-tax',
        name: 'Federal Income Tax',
        type: 'slab',
        baseOn: 'taxable',
        isDeduction: true,
        isStatutory: true,
        description: 'Federal income tax brackets',
        appliesTo: 'annual',
        slabs: [
          { min: 0, max: 11600, rate: 10, fixedAmount: 0 },
          { min: 11601, max: 47150, rate: 12, fixedAmount: 1160 },
          { min: 47151, max: 100525, rate: 22, fixedAmount: 5426 },
          { min: 100526, max: 191950, rate: 24, fixedAmount: 17168.50 },
          { min: 191951, max: 243725, rate: 32, fixedAmount: 39110.50 },
          { min: 243726, max: 609350, rate: 35, fixedAmount: 55678.50 },
          { min: 609351, max: null, rate: 37, fixedAmount: 183647.25 }
        ]
      }
    ]
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    country: 'UK',
    currency: 'GBP',
    locale: 'en-GB',
    taxYear: 2026,
    isCustom: false,
    rules: [
      {
        id: 'ni',
        name: 'National Insurance',
        type: 'slab',
        baseOn: 'gross',
        isDeduction: true,
        isStatutory: true,
        description: 'National Insurance contributions',
        appliesTo: 'monthly',
        slabs: [
          { min: 0, max: 1048, rate: 0, fixedAmount: 0 },
          { min: 1049, max: 4189, rate: 8, fixedAmount: 0 },
          { min: 4190, max: null, rate: 2, fixedAmount: 251.20 }
        ]
      },
      {
        id: 'income-tax',
        name: 'Income Tax',
        type: 'slab',
        baseOn: 'taxable',
        isDeduction: true,
        isStatutory: true,
        description: 'UK income tax rates',
        appliesTo: 'annual',
        slabs: [
          { min: 0, max: 12570, rate: 0, fixedAmount: 0 },
          { min: 12571, max: 50270, rate: 20, fixedAmount: 0 },
          { min: 50271, max: 125140, rate: 40, fixedAmount: 7540 },
          { min: 125141, max: null, rate: 45, fixedAmount: 25396 }
        ]
      }
    ]
  },
  {
    id: 'uae',
    name: 'UAE (No Tax)',
    country: 'UAE',
    currency: 'AED',
    locale: 'en-AE',
    taxYear: 2026,
    isCustom: false,
    rules: []
  },
  {
    id: 'custom',
    name: 'Custom Configuration',
    country: 'Custom',
    currency: 'USD',
    locale: 'en-US',
    taxYear: 2026,
    isCustom: true,
    rules: []
  }
];
