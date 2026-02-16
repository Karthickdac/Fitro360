export interface MarketConfig {
  currency: string;
  currencySymbol: string;
  taxLabel: string;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  defaultTaxRate: string;
  phonePrefix: string;
  phonePlaceholder: string;
}

const markets: Record<string, MarketConfig> = {
  uae: {
    currency: "AED",
    currencySymbol: "AED",
    taxLabel: "VAT",
    taxIdLabel: "TRN (Tax Registration Number)",
    taxIdPlaceholder: "100234567890003",
    defaultTaxRate: "5",
    phonePrefix: "+971",
    phonePlaceholder: "+971 50 123 4567",
  },
  india: {
    currency: "INR",
    currencySymbol: "₹",
    taxLabel: "GST",
    taxIdLabel: "GST Number",
    taxIdPlaceholder: "29ABCDE1234F1Z5",
    defaultTaxRate: "18",
    phonePrefix: "+91",
    phonePlaceholder: "+91 98765 43210",
  },
};

export function getMarketConfig(market?: string | null): MarketConfig {
  return markets[market || "uae"] || markets.uae;
}

export function formatCurrency(amount: number | string, market?: string | null): string {
  const config = getMarketConfig(market);
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (config.currencySymbol === "₹") {
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${config.currency} ${num.toFixed(2)}`;
}

export function formatCurrencyShort(amount: number, market?: string | null): string {
  const config = getMarketConfig(market);
  if (amount >= 1000) {
    return `${config.currencySymbol === "₹" ? "₹" : config.currency + " "}${(amount / 1000).toFixed(0)}k`;
  }
  return formatCurrency(amount, market);
}
