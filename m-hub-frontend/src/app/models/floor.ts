import { FloorType } from "../enums/floor-type.enum";

/**
 * Interface of floors ('Regelgeschosse') of buildings.
 */
export interface Floor {
//   type: "Unter" | "Über" | "Dach"; // or string if more flexibility needed
  type: FloorType; // Enum for standard floor types
  count: number; // number of floors of this type
  height: number; // height of standard floors of this type in cm
}