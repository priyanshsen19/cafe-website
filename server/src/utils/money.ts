/**
 * All money in this codebase is a whole number of rupees (INR). Menu pricing at
 * a café never needs sub-rupee precision, and integers keep totals exact —
 * no floating-point drift between what we charge and what we display.
 */

/** Rounds half-up to the nearest rupee. Used for percentage maths only. */
export function roundRupees(value: number): number {
  return Math.round(value + Number.EPSILON);
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}
