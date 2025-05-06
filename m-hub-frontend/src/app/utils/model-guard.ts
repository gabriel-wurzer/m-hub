import { Building } from "../models/building";

export function isBuilding(entity: any): entity is Building {
  return 'bw_geb_id' in entity;
}