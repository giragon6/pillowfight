import type { Faction } from './types/factions';

export const FACTION_COLORS: Record<Faction, number> = {
  Lavender: 0xB497BD,
  Yellow: 0xF7E967,
  Blue: 0x4DA6FF,
  Pink: 0xFF8FC0,
};

export const FACTION_NICKNAMES: Record<Faction, string> = {
  Lavender: "Pancake",
  Yellow: "Croissant",
  Blue: "Waffle",
  Pink: "Donut",
};

export const FACTION_ICONS: Record<Faction, string> = {
  Lavender: '🥞',
  Yellow: '🥐',
  Blue: '🧇',
  Pink: '🍩',
};

export function getFactionColor(faction: Faction): number {
  return FACTION_COLORS[faction];
}

export function getFactionNickname(faction: Faction): string {
  return FACTION_NICKNAMES[faction];
}

export function getFactionIcon(faction: Faction): string {
  return FACTION_ICONS[faction];
}

export default FACTION_COLORS;
