import type { Faction } from './types/factions';

export const FACTION_COLORS: Record<Faction, number> = {
  Lavender: 0xB497BD,
  Yellow: 0xF7E967,
  Blue: 0x4DA6FF,
  Pink: 0xFF8FC0,
};

export function getFactionColor(faction: Faction): number {
  return FACTION_COLORS[faction];
}

export default FACTION_COLORS;
