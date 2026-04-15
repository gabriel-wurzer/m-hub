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
  condition?: string;
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
