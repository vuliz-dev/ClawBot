export function calculate(expr: string): string {
  // Only allow safe math characters
  if (!/^[\d\s+\-*/().^%,]+$/.test(expr)) {
    return "Invalid expression. Only numbers and math operators are allowed.";
  }
  try {
    // Replace ^ with ** for exponentiation
    const safe = expr.replace(/\^/g, "**");
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safe})`)();
    if (typeof result !== "number" || !isFinite(result)) {
      return "Could not compute result.";
    }
    return String(result);
  } catch {
    return "Could not compute result.";
  }
}
