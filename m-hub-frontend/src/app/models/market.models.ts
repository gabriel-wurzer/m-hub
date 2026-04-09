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
  condition: string;
  dimensions: MarketListingDimension[];
  location: string;
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
