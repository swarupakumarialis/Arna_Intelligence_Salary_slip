/**
 * Default subject/body copy for the "Email Employee" flow. Pure string
 * builders — no side effects, no DOM/email APIs — so EmailSalaryModal
 * can prefill its fields and the user can still edit either before
 * sending. companyName is the one dynamic, tenant-aware piece (already
 * sourced from BrandConfig everywhere else in the app); the "ARNA HR
 * Team" sign-off is the literal requested copy for this deployment.
 */
export interface EmailTemplateParams {
  employeeName: string;
  month: string;
  year: string | number;
  companyName: string;
}

export function buildEmailSubject({ month, year }: Pick<EmailTemplateParams, 'month' | 'year'>): string {
  return `Salary Slip – ${month} ${year}`;
}

export function buildEmailBody({ employeeName, month, year, companyName }: EmailTemplateParams): string {
  return `Dear ${employeeName},

Please find attached your salary slip for ${month} ${year}.

If you have any questions regarding your payroll, please contact the HR team.

Regards,
ARNA HR Team
${companyName}`;
}
