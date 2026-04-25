import type { Faction } from '../shared/types/factions';
import type { PlayerData } from '../shared/types/playerTypes';

export default class Player {
    id: string;
    username: string;
    avatar: string;
    sound: string;
    faction: Faction;

    constructor(socketId: string, x: number, y: number, playerData: PlayerData) {
        this.id = socketId;
        this.username = playerData.username;
        this.avatar = playerData.avatar;
        this.sound = playerData.sound;
        this.faction = playerData.faction;
    }

    updatePlayerData(newData: PlayerData) {

    }

    updatePosition(newX: number, newY: number) {

    }

    toJSON() {
        return { id: this.id, username: this.username, avatar: this.avatar, sound: this.sound, faction: this.faction };
    }
}