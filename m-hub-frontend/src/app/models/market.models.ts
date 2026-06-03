import { MarketListingStatus } from '../enums/market-listing-status';
import { MarketListingUnit } from '../enums/market-listing-unit.enum';
import { MarketPotential } from '../enums/market-potential.enum';

export type MarketCategoryKind = 'material' | 'object';

export interface MarketListingDimension {
  label: string;
  value: string;
}

export interface MarketListing {
  id: string;
  title: string;
  price: string;
  quantity: string;
  quantityLabel?: string;
  material?: string | null;
  potential?: string | null;
  status?: string | null;
  availableFrom?: string | null;
  dimensions?: MarketListingDimension[];
  location: string;
  address?: string | null;
  imageSrc: string;
  imageAlt: string;
}

export interface MarketCategory {
  id: string;
  title: string;
  kind: MarketCategoryKind;
  label: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  listings: MarketListing[];
}

export interface MarketListingNumericRange {
  min: number;
  max: number;
}

export interface MarketListingFilterBounds {
  price: MarketListingNumericRange;
}

export interface MarketListingFilter {
  priceMin: number;
  priceMax: number;
  quantityMin: number | null;
  quantityUnit: MarketListingUnit | null;
  availableFromMin: string | null;
  potentials: MarketPotential[];
  statuses: MarketListingStatus[];
}

export const MARKET_LISTING_PRICE_UNBOUNDED_MAX = Number.POSITIVE_INFINITY;
export const MARKET_LISTING_PRICE_OPTIONS: number[] = buildMarketListingPriceOptions();

export const DEFAULT_MARKET_LISTING_FILTER_BOUNDS: MarketListingFilterBounds = {
  price: { min: 0, max: MARKET_LISTING_PRICE_UNBOUNDED_MAX }
};

export function createMarketListingFilter(
  bounds: MarketListingFilterBounds = DEFAULT_MARKET_LISTING_FILTER_BOUNDS
): MarketListingFilter {
  return {
    priceMin: bounds.price.min,
    priceMax: MARKET_LISTING_PRICE_UNBOUNDED_MAX,
    quantityMin: null,
    quantityUnit: null,
    availableFromMin: null,
    potentials: [],
    statuses: [],
  };
}

export function normalizeMarketListingPriceRange(
  minValue: unknown,
  maxValue: unknown
): MarketListingNumericRange {
  const min = normalizeMarketListingPriceValue(minValue, 0, false);
  const max = normalizeMarketListingPriceValue(maxValue, MARKET_LISTING_PRICE_UNBOUNDED_MAX, true);

  return min <= max
    ? { min, max }
    : { min: max, max: min };
}

export function normalizeMarketListingPriceValue(
  value: unknown,
  fallback: number,
  allowUnbounded = true
): number {
  const numericValue = parseMarketListingNumericInput(value);

  if (numericValue === null || (!allowUnbounded && !Number.isFinite(numericValue))) {
    return fallback;
  }

  return Math.max(0, numericValue);
}

export function getMarketListingPriceOptionIndex(value: number, allowUnbounded: boolean): number {
  if (!Number.isFinite(value)) {
    return allowUnbounded ? MARKET_LISTING_PRICE_OPTIONS.length - 1 : MARKET_LISTING_PRICE_OPTIONS.length - 2;
  }

  const lastFiniteIndex = MARKET_LISTING_PRICE_OPTIONS.length - 2;

  if (value >= MARKET_LISTING_PRICE_OPTIONS[lastFiniteIndex]) {
    return allowUnbounded && value > MARKET_LISTING_PRICE_OPTIONS[lastFiniteIndex]
      ? MARKET_LISTING_PRICE_OPTIONS.length - 1
      : lastFiniteIndex;
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= lastFiniteIndex; index++) {
    const distance = Math.abs(MARKET_LISTING_PRICE_OPTIONS[index] - value);

    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  }

  return closestIndex;
}

export function parseMarketListingNumericInput(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value === MARKET_LISTING_PRICE_UNBOUNDED_MAX ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  if (trimmedValue.toLowerCase() === 'beliebig') {
    return MARKET_LISTING_PRICE_UNBOUNDED_MAX;
  }

  const withoutUnit = trimmedValue.replace(/[€\s]/g, '');
  const normalizedValue = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(withoutUnit)
    ? withoutUnit.replace(/\./g, '').replace(',', '.')
    : withoutUnit.replace(',', '.');
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildMarketListingPriceOptions(): number[] {
  const options = new Set<number>();

  addSteppedPriceOptions(options, 0, 250, 10);
  addSteppedPriceOptions(options, 250, 1000, 50);
  addSteppedPriceOptions(options, 1000, 1500, 100);
  addSteppedPriceOptions(options, 1500, 3000, 500);
  addSteppedPriceOptions(options, 3000, 10000, 1000);
  addSteppedPriceOptions(options, 10000, 100000, 10000);

  return [...options].sort((left, right) => left - right).concat(MARKET_LISTING_PRICE_UNBOUNDED_MAX);
}

function addSteppedPriceOptions(options: Set<number>, start: number, end: number, step: number): void {
  for (let value = start; value <= end; value += step) {
    options.add(value);
  }
}
