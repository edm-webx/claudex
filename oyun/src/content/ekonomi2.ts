/**
 * Faz 2 ekonomi (MMORPG mantığı): para zor kazanılır, değeri vardır. Pure data, every number in one place.
 * Why the old economy inflated (46 milyar ₺ in 90 min): price × tier (×10) × tadilat (×12) × plaket (×2 per plaque)
 * × streak (×1.5) × set × siftah all multiplied together, and every side system (ferry, kurye, deniz, goals, hava)
 * paid "minutes of income", so income fed income. Now:
 * - Prices are 2026 İstanbul büfe prices (products.ts); a kademe adds a small premium (TIER_X), not ×10.
 * - Venue multipliers are flat and capped (VENUE_CAP). A büfe grows by capacity (more customers, stands, tables),
 *   not by multiplying prices.
 * - Every sale pays its ingredients (MALIYET): what you see is net profit.
 * - Side income (everything that isn't a sale or a tip) is a "faucet" capped per game day (BONUS_*).
 * - Day end costs (GIDER): kira + elektrik/su/tüp grow with the venue: the sink that keeps money valuable.
 *   Never pushes money below zero (no losing, survey).
 * - Kepenk (offline): almost nothing (owner: "pasif gelir olmamalı veya çok cüzi").
 */
import type { ProductId } from '../game/sim/schema';

/** Ingredient cost share of the sell price, per product (net margin = 1 - this). */
// 2026-10-24 user: "para kazanma düzeldi ama aşırı yavaş, biraz açabiliriz": ingredients ~10 points cheaper (net margin up ~25 %)
export const MALIYET: Record<ProductId, number> = { doner: 0.35, cay: 0.15, ayran: 0.27, simit: 0.3, tost: 0.3, gazoz: 0.45 };
/** Kademe price premium (K1..K4). Better product = a bit dearer, mostly more demand and patience. */
export const TIER_PRICE_X = [1, 1.15, 1.35, 1.6];
/** Kademe upgrade cost as base price × factor (K2, K3, K4). */
export const TIER_COST_F = [0, 60, 250, 900];
/** Venue multiplier pieces (all additive), and the hard cap. */
export const VENUE = { perStage: 0.04, perPlaque: 0.05, perStar: 0.02, siklikMax: 0.08, cap: 1.45 };
export const STREAK = { step: 0.025, max: 4 };          // Sıcak Tezgah: at most +10 %
export const SIFTAH_X = 1.5;
/** Side income cap per game day: max(BONUS_MIN, BONUS_FRAC × today's sales). Extra is simply not paid. */
export const BONUS_MIN = 250, BONUS_FRAC = 0.3;
/** Day end costs per kiosk stage (index = stage-1): rent, and utilities as a share of the day's sales. */
export const GIDER = { kira: [0, 150, 550, 1900, 5600, 9000, 14000, 21000, 30000, 42000], fatura: 0.03, minSales: 1 };
/** Offline: hours cap and rate per kepenk level (rate × idle income/min). */
export const KEPENK2: [number, number][] = [[1, 0.02], [2, 0.03], [3, 0.04], [4, 0.05]];
/** Tadilat costs (stage 2..5) and crew seconds: rarer, dearer, real change. */
export const STAGE_COST = [0, 25000, 180000, 900000, 4500000, 12000000, 30000000, 70000000, 150000000, 300000000];
export const STAGE_TIME_S = [0, 90, 300, 900, 1800, 2400, 3000, 3600, 4200, 4800];
/** Stage income multiplier shown on the tadilat card (flat now, the growth is capacity). */
export const STAGE_MULT = [1, 1.04, 1.08, 1.12, 1.16, 1.2, 1.24, 1.28, 1.32, 1.36];
/** Arrival rate bonus per stage (customers / min) - the real reward of a tadilat. */
export const STAGE_ARRIVAL = [0, 2.6, 5.5, 9, 13, 15.5, 18, 20.5, 23, 25.5];

export const fmtTL = (v: number): string => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
