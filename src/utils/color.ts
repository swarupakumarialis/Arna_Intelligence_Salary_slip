/**
 * Appends a two-digit hex alpha suffix to a 6-digit hex colour, e.g.
 * withAlpha('#0F172A', '18') => '#0F172A18'. Centralises the alpha-hex
 * convention used throughout the payslip so the same opacity values
 * aren't hand-typed at every call site.
 */
export function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}
