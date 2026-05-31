// Amazon US FBA profit math. Simplified but realistic fee model so the
// numbers on every deal card are internally consistent. Swap these
// estimates for live SP-API GetMyFeesEstimate once credentials are wired.

export interface ProfitInputs {
  cost: number; // your per-unit source cost
  sellPrice: number; // Amazon buy-box price
  category: string; // drives referral-fee %
  weightLb?: number; // for FBA fulfillment estimate
}

export interface ProfitResult {
  referralFee: number;
  fbaFee: number;
  totalFees: number;
  profit: number;
  roi: number; // %
  margin: number; // %
  breakeven: number; // sell price needed for $0 profit
}

// Amazon US referral fee % by broad category (close to published rates).
const REFERRAL_RATES: Record<string, number> = {
  Toys: 0.15,
  Electronics: 0.08,
  "Home & Kitchen": 0.15,
  "Sports & Outdoors": 0.15,
  "Health & Household": 0.15,
  "Beauty": 0.08,
  "Grocery": 0.08,
  "Office Products": 0.15,
  "Pet Supplies": 0.15,
  "Tools & Home Improvement": 0.15,
  default: 0.15,
};

function referralRate(category: string): number {
  return REFERRAL_RATES[category] ?? REFERRAL_RATES.default;
}

// Rough FBA fulfillment fee by weight (US, standard size tiers).
function estimateFbaFee(weightLb: number): number {
  if (weightLb <= 0.25) return 3.06;
  if (weightLb <= 0.5) return 3.4;
  if (weightLb <= 0.75) return 3.72;
  if (weightLb <= 1) return 3.99;
  if (weightLb <= 2) return 4.75;
  if (weightLb <= 3) return 5.4;
  return 5.4 + (weightLb - 3) * 0.38;
}

export function calcProfit(inp: ProfitInputs): ProfitResult {
  const referralFee = +(inp.sellPrice * referralRate(inp.category)).toFixed(2);
  const fbaFee = +estimateFbaFee(inp.weightLb ?? 1).toFixed(2);
  const totalFees = +(referralFee + fbaFee).toFixed(2);
  const profit = +(inp.sellPrice - inp.cost - totalFees).toFixed(2);
  const roi = inp.cost > 0 ? +((profit / inp.cost) * 100).toFixed(1) : 0;
  const margin =
    inp.sellPrice > 0 ? +((profit / inp.sellPrice) * 100).toFixed(1) : 0;
  const breakeven = +(inp.cost + totalFees).toFixed(2);
  return { referralFee, fbaFee, totalFees, profit, roi, margin, breakeven };
}
