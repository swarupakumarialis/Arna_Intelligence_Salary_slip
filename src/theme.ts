/* ============================================================
   ARNA Learning Intelligence Studio Pvt. Ltd.
   Official Brand Colour System
   ============================================================ */

export const ARNA = {
  /* Primary Palette */
  deepNavy:    '#0F172A',
  teal:        '#0D9488',
  mintTeal:    '#5EEAD4',
  accentTeal:  '#14B8A6',
  amber:       '#F59E0B',
  slateGrey:   '#64748B',
  offWhite:    '#F8FAFC',

  /* Derived / Supporting */
  white:       '#FFFFFF',
  border:      '#E2E8F0',
  hover:       '#ECFEFF',
  danger:      '#DC2626',
  dangerSoft:  '#FEF2F2',

  /* Text on Dark */
  textOnDark:  '#FFFFFF',
  mutedOnDark: '#94A3B8',
} as const;

export type ArnaColor = typeof ARNA[keyof typeof ARNA];
