/**
 * Enum for supported construction periods.
 */
export enum Period {
  p_unknown = 0, 
  p_s1919 = 1,
  p_s1945 = 2,
  p_s1980 = 3,
  p_s2000 = 4,
  p_geq2000 = 5,
} 

export const PeriodLabels: Record<number, string> = {
  [Period.p_unknown]: 'Bauperiode unbekannt',
  [Period.p_s1919]: 'Bauperiode vor 1919',
  [Period. p_s1945]: 'Bauperiode 1919-1944',
  [Period. p_s1980]: 'Bauperiode 1945-1979',
  [Period.p_s2000]: 'Bauperiode 1980-1999',
  [Period.p_geq2000]: 'Bauperiode nach 2000',
};  