import { BuildingComponentCategory } from "../enums/component-category";
import { MarketListingStatus } from "../enums/market-listing-status";
import { MarketPotential } from "../enums/market-potential.enum";
import { MarketListingUnit } from "../enums/market-listing-unit.enum";
import { MaterialType } from "../enums/material-type.enum";
import { ObjectType } from "../enums/object-type";


export class MarketListing {
  id!: string;

  // relation to source component
  component_id!: string;
  owner_id!: string;
  user_building_id!: string;
  building_id!: string;
  location!: string;
  component_category!: BuildingComponentCategory;   // Bauteil | Objekt
  // Bauteil-specific snapshot
  material?: MaterialType;
  // Objekt-specific snapshot
  object_type?: ObjectType;
  length?: number | null;
  width?: number | null;
  height?: number | null;

  // marketplace data
  name!: string;
  description?: string;
  price!: number;
  status!: MarketListingStatus;
  available_from?: string;   // ISO date, not dd.mm.yy in DB
  potential!: MarketPotential;
  quantity!: number;
  unit!: MarketListingUnit;
  contact!: string;
  images?: MarketListingImage[];
  created_at!: string;
  updated_at!: string;
}

export class MarketListingImage {
  id!: string;
  market_listing_id!: string;
  sort_order!: number;
  image_path!: string;
  image_mime_type?: string;
  image_original_name?: string;
  image_size_bytes?: number;
  image_url?: string;
  created_at!: string;
  updated_at!: string;
}


export type CreateMarketListingImagePayload = {
  image_data_url: string;
  image_mime_type?: string;
  image_original_name?: string;
  sort_order?: number;
};

export type CreateMarketListing = {
  component_id: string;
  building_id: string;
  user_building_id: string;
  owner_id: string;
  location: string;
  component_category: BuildingComponentCategory;   // Bauteil | Objekt
  material?: MaterialType;
  object_type?: ObjectType;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  name: string;
  description?: string;
  price: number;
  potential: MarketPotential;
  quantity: number;
  unit: MarketListingUnit;
  status: MarketListingStatus;
  available_from: string;   // ISO date, not dd.mm.yy
  contact: string;
  images?: CreateMarketListingImagePayload[];
};
