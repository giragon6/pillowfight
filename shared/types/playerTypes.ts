import type { Faction } from './factions'

export type PlayerJSON = {
    id: string;
    username: string;
}

export type PlayerData = {
    username: string;
    avatar: string; // avatar uid
    sound: string; // sound uid
    faction: Faction;
}

export type PlayerPositionData = {
    playerId: string;
    x: number;
    y: number;
}