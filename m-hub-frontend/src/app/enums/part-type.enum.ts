/**
 * Enum for supported types of 'Bauteil'.
 */
export enum PartType {
    // Wand = 'Wand',                   // Unterscheiden zwischen Wall-Types: Außen-, Innen- & Brandwand für RG und KG
    Innenwand = 'Innenwand',
    Aussenwand = 'Aussenwand',
    Brandwand = 'Brandwand',
    Kniestock = 'Kniestock',            // Wand im Geschosstyp Dach mit Typ Steildach
    Attika = 'Attika',                  // Wand im Geschosstyp Dach mit Typ Flachdach
    Boden = 'Boden',                    // nicht erlaubt für Dach mit Rooftype Flachdach
    Dachaufbau = 'Dachaufbau',          // nicht erlaubt für KG; für RG muss zunächst auch Rooftype angegeben werden
}
