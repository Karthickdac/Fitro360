import { useAuth } from "@/lib/auth";
import { getMarketConfig, formatCurrency, formatCurrencyShort, type MarketConfig } from "@/lib/market";

export function useMarket() {
  const { tenant } = useAuth();
  const market = (tenant as any)?.market as string | undefined;
  const config = getMarketConfig(market);

  return {
    config,
    market: market || "uae",
    fmt: (amount: number | string) => formatCurrency(amount, market),
    fmtShort: (amount: number) => formatCurrencyShort(amount, market),
  };
}
