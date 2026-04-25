import type { PlayerData } from '../shared/types/playerTypes';
import Player from './Player'

export class GameManager {
    players: Map<string, Player>;

    constructor() {
        this.players = new Map();
    }

    addPlayer(socketId: string, playerData: PlayerData) {
        const player = new Player(socketId, 800, 600, playerData);
        this.players.set(socketId, player);
        return player;
    }

    updatePlayerData(socketId: string, playerData: PlayerData) {
        const player = this.players.get(socketId);
        if (player) {
            player.updatePlayerData(playerData);
        }
        return player;
    }

    removePlayer(socketId: string) {
        this.players.delete(socketId);
    }

    updatePlayerPosition(socketId: string, x: number, y: number) {
        const player = this.players.get(socketId);
        if (player) {
            player.updatePosition(x, y);
        }
    }

    getPlayer(socketId: string) {
        return this.players.get(socketId);
    }

    getAllPlayers() {
        return Array.from(this.players.values()).map(player => player.toJSON());
    }

}