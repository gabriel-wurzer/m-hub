import { BuildingComponent } from "./building-component";

/**
 * Interface of buildings.
 */
export interface Building {
    bw_geb_id: number;
    dom_nutzung: number;
    bp: string;
    m3vol: number;
    m2bgf: number;
    m2bgf_use1: number;
    m2bgf_use2: number;
    m2bgf_use3: number;
    m2bgf_use4: number;
    m2flaeche: number;
    maxhoehe: number;
    bmg1: number;
    bmg2: number;
    bmg3: number;
    bmg4: number;
    bmg5: number;
    bmg6: number;
    bmg7: number;
    bmg8: number;
    bmg9: number;
    geometry: any; // Geometry as GeoJSON object
    buildingComponents?: BuildingComponent[];  // Optional list of building parts
    documents?: Document[]; // Optional list of appended documents
    structure?: number[]; // Array of numbers representing the structure of the building -> [KG, EG, OG, DG]

    // user-specific fields
    name?: string; // user specific name of the building
    address?: string; // user specific address of the building
}