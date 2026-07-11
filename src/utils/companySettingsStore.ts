import { ARNA_LOGO_DATA_URI } from '../assets/arnaLogo';
import type { CurrencyCode } from '../contexts/CurrencyContext';

/**
 * White-label company identity + branding. This is the "company_settings"
 * collection referenced in the app's storage architecture — kept as one
 * cohesive object (rather than split further into a separate "branding"
 * blob) because every field here is edited together on one screen and
 * consumed together by the preview/PDF/nav chrome; splitting it would
 * add a second load/save/merge path with no functional benefit.
 */
export interface BrandConfig {
  companyName: string;
  companyAddress: string;
  logoDataUri: string | null;
  primaryColour: string;
  secondaryColour: string;
  /* Optional company identity fields — only shown when non-empty */
  gstin?: string;
  pan?: string;
  website?: string;
  email?: string;
  phone?: string;
  /* Display flags — each controls one element */
  showLogo?: boolean;
  showCompanyName?: boolean;
  showCompanyAddress?: boolean;
  showGstin?: boolean;
  showPan?: boolean;
  showWebsite?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showNameWatermark?: boolean;
  showSignatory?: boolean;
  showPoweredBy?: boolean;
  showGeneratedDate?: boolean;
  showGeneratedTime?: boolean;
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryImageUri?: string | null;
  /* Display-only currency preference (see CurrencyContext) — payroll
     is always calculated and stored in INR; these two fields only
     control how amounts are *shown* across the Dashboard, Salary
     History, Payroll Export, and Salary Generator screens. */
  defaultCurrency?: CurrencyCode;
  /** 1 USD = exchangeRate INR. */
  exchangeRate?: number;
}

export const DEFAULT_BRAND: BrandConfig = {
  companyName: 'Arnas Learning Intelligence Studio Pvt. Ltd.',
  companyAddress: 'Nexus Business Centre,\nLevel 4,\nPlot No 802 & 803,\nAyyappa Society Road,\nMadhapur,\nHyderabad – 500081,\nTelangana',
  logoDataUri: ARNA_LOGO_DATA_URI,
  primaryColour: '#0F172A',
  secondaryColour: '#5EEAD4',
  gstin: '',
  pan: '',
  website: '',
  email: '',
  phone: '',
  showLogo: true,
  showCompanyName: true,
  showCompanyAddress: true,
  showGstin: true,
  showPan: true,
  showWebsite: true,
  showEmail: true,
  showPhone: true,
  showNameWatermark: false,
  showSignatory: false,
  showPoweredBy: true,
  showGeneratedDate: true,
  showGeneratedTime: true,
  signatoryName: '',
  signatoryTitle: 'Authorised Signatory',
  signatoryImageUri: null,
  defaultCurrency: 'INR',
  exchangeRate: 86,
};

const STORAGE_KEY = 'arna_company_settings_v1';
/** Pre-Sprint-2 storage key, when brand config lived inline in App.tsx. */
const LEGACY_STORAGE_KEY = 'salary_slip_brand_v1';

export function loadCompanySettings(): BrandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrandConfig>;
      return { ...DEFAULT_BRAND, ...parsed };
    }
    // One-time migration so existing users don't see their settings reset.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const merged = { ...DEFAULT_BRAND, ...(JSON.parse(legacy) as Partial<BrandConfig>) };
      saveCompanySettings(merged);
      return merged;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_BRAND;
}

export function saveCompanySettings(b: BrandConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}
