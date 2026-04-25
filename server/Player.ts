import type { Faction } from '../shared/types/factions';
import type { PlayerData, PlayerJSON } from '../shared/types/playerTypes';

export default class Player {
    id: string;
    username: string;
    avatar: string;
    sound: string;
    faction: Faction;
    x: number;
    y: number;

    constructor(socketId: string, x: number, y: number, playerData: PlayerData) {
        this.id = socketId;
        this.username = playerData.username;
        this.avatar = playerData.avatar;
        this.sound = playerData.sound;
        this.faction = playerData.faction;
        this.x = x;
        this.y = y;
    }

    updatePlayerData(newData: PlayerData) {
        this.username = newData.username;
        this.avatar = newData.avatar;
        this.sound = newData.sound;
        this.faction = newData.faction;
    }

    updatePosition(newX: number, newY: number) {
        this.x = newX;
        this.y = newY;
    }

    toJSON(): PlayerJSON {
        return { 
            id: this.id, 
            username: this.username, 
            avatar: this.avatar, 
            sound: this.sound, 
            faction: this.faction, 
            x: this.x, 
            y: this.y,
        };
    }
}