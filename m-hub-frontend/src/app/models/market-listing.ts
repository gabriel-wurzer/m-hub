import { BuildingComponentCategory } from "../enums/component-category";
import { MarketListingStatus } from "../enums/market-listing-status";
import { MarketPotential } from "../enums/market-potential.enum";
import { MarketUnit } from "../enums/market-unit.enum";
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
  object_count?: number;

  // marketplace data
  name!: string;
  description?: string;
  price!: number;
  status!: MarketListingStatus;
  available_from?: string;   // ISO date, not dd.mm.yy in DB
  potential!: MarketPotential;
  quantity!: number;
  unit!: MarketUnit;
  contact!: string;

  created_at!: string;
  updated_at!: string;
}