export type PokemonKey = string; // e.g. "pichu", "rattata:forme-1"
export type TrackStatus = 'unseen' | 'seen' | 'caught';
export type TimeOfDay = 'day' | 'night';

export interface PokemonIdentity {
  key: PokemonKey;
  displayName: string;   // "Alolan Rattata", "Pichu", etc.
  sourceName: string;    // exact name from raw data: "Rattata (Forme 1)"
  form?: string;         // "forme-1" if present
}

export interface Encounter {
  pokemon: PokemonIdentity;
  rate: number;
  minLevel: number;
  maxLevel: number;
}

export interface SOSEncounter extends Encounter {
  slots: number[];       // e.g. [1,2,3,4]
}

export interface EncounterTable {
  id: string;            // "table-1", "table-2"
  label: string;         // "Table 1"
  minLevel: number;
  maxLevel: number;
  day: Encounter[];
  night: Encounter[];
  sosDayConsolidated: SOSEncounter[];
  sosNightConsolidated: SOSEncounter[];
}

export interface MapRecord {
  mapIds: number[];
  locationNames: string[];
  primaryName: string;
  tables: EncounterTable[];
}

export interface Area {
  id: string;
  primaryName: string;
  allNames: string[];
  mapIds: number[];
  tables: EncounterTable[];
}
