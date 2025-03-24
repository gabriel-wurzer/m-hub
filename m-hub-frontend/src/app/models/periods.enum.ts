export enum Periods {
  p_unknown = 0, 
  p_s1919 = 1,
  p_s1945 = 2,
  p_s1980 = 3,
  p_s2000 = 4,
  p_geq2000 = 5,
} 

export const PeriodLabels: Record<number, string> = {
  [Periods.p_unknown]: 'Bauperiode unbekannt',
  [Periods.p_s1919]: 'Bauperiode vor 1919',
  [Periods. p_s1945]: 'Bauperiode 1919-1944',
  [Periods. p_s1980]: 'Bauperiode 1945-1979',
  [Periods.p_s2000]: 'Bauperiode 1980-1999',
  [Periods.p_geq2000]: 'Bauperiode nach 2000',
};  