import type { PlayerData } from '../shared/types/playerTypes';
import Player from './Player'
import { TilemapManager } from './TilemapManager';

export class GameManager {
    players: Map<string, Player>;
    tilemapManager: TilemapManager;

    constructor() {
        this.players = new Map();
        this.tilemapManager = new TilemapManager(50, 50, 32);
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

    getAllPlayers() {
        return Array.from(this.players.values()).map(player => player.toJSON());
    }

    getTilemap() {
        return this.tilemapManager;
    }

    updateTile(x: number, y: number, index: number, properties?: Record<string, any>) {
        return this.tilemapManager.putTile(x, y, index, properties);
    }

    claimTiles(playerId: string, tiles: Array<{x: number, y: number}>) {
        const player = this.players.get(playerId);
        if (!player) {
            return [];
        }
        return this.tilemapManager.claimTiles(playerId, player.faction, tiles);
    }

    allocateSpawnPatch(playerId: string, patchSize: number) {
        const player = this.players.get(playerId);
        if (!player) {
            return [];
        }
        return this.tilemapManager.allocateSpawnPatch(playerId, player.faction, patchSize);
    }

    unclaimTiles(tiles: Array<{x: number, y: number}>) {
        return this.tilemapManager.unclaimTiles(tiles);
    }

    getTilesByOwner(playerId: string) {
        return this.tilemapManager.getTilesByOwner(playerId);
    }
}