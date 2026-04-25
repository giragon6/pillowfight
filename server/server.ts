import { GameManager } from "./GameManager";
import type { PlayerData, PlayerJSON } from "../shared/types/playerTypes";
import express from 'express';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./events";
import { Server } from 'socket.io';
import http from 'http';
import type { ScenePosition } from "../src/game/types";
import type { TileData } from "./TilemapManager";

const app = express();
const httpServer = http.createServer(app);

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData
>(httpServer, {
    cors: {
        origin: '*'
    }
});

const gameManager = new GameManager();

// Spawn patch size for each player (5x5 by default)
const SPAWN_PATCH_SIZE = 5;

//todo: move this
export type GameInitData = {
    playerId: string, 
    player: PlayerJSON, 
    playerData: PlayerData, 
    players: PlayerJSON[],
    tilemap: {
        tiles: TileData[],
        width: number,
        height: number,
        tileWidth: number,
        tileHeight: number
    }
};

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    socket.on('playerCustomization', (playerData: PlayerData) => {
        console.log('Received player customization:', playerData);
        
        const player = gameManager.addPlayer(socket.id, playerData);
        const tilemap = gameManager.getTilemap();
        
        // Allocate and claim spawn patch for the new player
        const spawnTiles = gameManager.allocateSpawnPatch(socket.id, SPAWN_PATCH_SIZE);
        if (spawnTiles.length > 0) {
            // Broadcast the newly claimed spawn patch to all clients
            io.emit('tilesClaimed', spawnTiles);
        }
                
        // Send initial game state to the new player
        socket.emit('gameInit', {
            playerId: socket.id,
            player: player.toJSON(),
            playerData: playerData,
            players: gameManager.getAllPlayers().filter(p => p.id !== socket.id),
            tilemap: {
                tiles: tilemap.getAllTiles(),
                width: tilemap.width,
                height: tilemap.height,
                tileWidth: tilemap.tileWidth,
                tileHeight: tilemap.tileHeight
            }
        });

        // Broadcast new player to all other players
        socket.broadcast.emit('playerJoined', player.toJSON(), playerData);
    });

    socket.on('playerMove', (data: ScenePosition) => {
        gameManager.updatePlayerPosition(socket.id, data.x, data.y);
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: data.x,
            y: data.y
        });
    });

    // Handle single tile update
    socket.on('tileUpdate', (data: { x: number; y: number; index: number; properties?: Record<string, any> }) => {
        const tilemap = gameManager.getTilemap();
        const updatedTile = tilemap.putTile(data.x, data.y, data.index, data.properties);

        // Broadcast updated tile to all clients
        if (updatedTile) {
            io.emit('tileUpdated', updatedTile);
        }
    });

    // Handle batch tile updates
    socket.on('tilesUpdate', (tiles: Array<{ x: number; y: number; index: number; properties?: Record<string, any> }>) => {
        const tilemap = gameManager.getTilemap();
        const updatedTiles = tiles.map(tile => {
            return tilemap.putTile(tile.x, tile.y, tile.index, tile.properties);
        }).filter(tile => tile !== undefined) as TileData[];

        // Broadcast updated tiles to all clients
        if (updatedTiles.length > 0) {
            io.emit('tilesUpdated', updatedTiles);
        }
    });

    // Handle tile claiming
    socket.on('claimTiles', (tiles: Array<{ x: number; y: number }>) => {
        const claimedTiles = gameManager.claimTiles(socket.id, tiles);
        
        // Broadcast claimed tiles to all clients
        if (claimedTiles.length > 0) {
            io.emit('tilesClaimed', claimedTiles);
        }
    });

    // Handle tile unclaiming
    socket.on('unclaimTiles', (tiles: Array<{ x: number; y: number }>) => {
        const unclaimedTiles = gameManager.unclaimTiles(tiles);
        
        // Broadcast unclaimed tiles to all clients
        if (unclaimedTiles.length > 0) {
            io.emit('tilesUnclaimed', unclaimedTiles);
        }
    });

    //todo: handle this (show game UI)
    socket.on('gameSceneReady', () => {

    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
                
        // Remove player and broadcast
        gameManager.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});