/**
 * Enum for supported types of 'Bauteil'.
 */
export enum PartType {
    BA = 'Bodenaufbau',         // nicht erlaubt für Dach mit Rooftype Flachdach
    DA = 'Dachaufbau',          // nicht erlaubt für KG
    IW = 'Innenwand',
    AW = 'Außenwand',
    BW = 'Brandwand',
    KS = 'Kniestock',           // Wand im Geschosstyp Dach mit Typ Steildach
    A  = 'Attika',              // Wand im Geschosstyp Dach mit Typ Flachdach
}
