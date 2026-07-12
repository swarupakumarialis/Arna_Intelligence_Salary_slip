/**
 * Default subject/body copy for the "Email Employee" flow. Pure
 * string builders — no side effects, no DOM/email APIs — used by
 * EmailSalaryModal to prefill/preview what will be sent, and mirrored
 * server-side in backend/src/services/email.service.js (which is
 * authoritative for what's actually emailed). Deliberately NOT
 * parameterised by companyName — this is the literal, verbatim copy
 * requested, hardcoding "Arna Intelligence" in the sign-off rather
 * than the usual dynamic BrandConfig.companyName used elsewhere.
 */
export interface EmailTemplateParams {
  employeeName: string;
  month: string;
  year: string | number;
}

export function buildEmailSubject({ month, year }: Pick<EmailTemplateParams, 'month' | 'year'>): string {
  return `Salary Slip – ${month} ${year} | ARNA Intelligence`;
}

export function buildEmailBody({ employeeName, month, year }: EmailTemplateParams): string {
  return `Dear ${employeeName},

I hope you are doing well.

Please find attached your salary slip for the month of ${month} ${year}.

Kindly review the attached document for your records. If you have any questions or notice any discrepancies, please feel free to reach out to the HR team.

Thank you for your continued dedication and valuable contributions to Arna Intelligence. We truly appreciate your commitment and wish you continued success.

Best regards,

Team HR
Arna Intelligence`;
}
