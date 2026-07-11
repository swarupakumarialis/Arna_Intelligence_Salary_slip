/** Reserved id for the automatically calculated Loss-of-Pay deduction row. */
export const LOP_DEDUCTION_ID = 'lop-auto';

export interface LopResult {
  grossSalary: number;
  perDaySalary: number;
  lopAmount: number;
  netGross: number;
}

/**
 * Per Day Salary = Gross Salary / Working Days
 * LOP Deduction  = Per Day Salary × LOP Days
 * Net Gross      = Gross Salary − LOP Deduction
 */
export function calculateLop(grossSalary: number, workingDays: number, lopDays: number): LopResult {
  const perDaySalary = workingDays > 0 ? grossSalary / workingDays : 0;
  const lopAmount = Math.round(perDaySalary * (lopDays || 0) * 100) / 100;
  const netGross = Math.max(0, Math.round((grossSalary - lopAmount) * 100) / 100);
  return { grossSalary, perDaySalary, lopAmount, netGross };
}
