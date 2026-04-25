import { GameManager } from "./GameManager";
import type { PlayerData, PlayerJSON } from "../shared/types/playerTypes";
import express from 'express';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./events";
import { Server } from 'socket.io';
import http from 'http';
import type { ScenePosition } from "../src/game/types";

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

//todo: move this
export type GameInitData = {playerId: string, player: PlayerJSON, playerData: PlayerData, players: PlayerJSON[]};

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    socket.on('playerCustomization', (playerData: PlayerData) => {
        console.log('Received player customization:', playerData);
        
        const player = gameManager.addPlayer(socket.id, playerData);
                
        // Send initial game state to the new player
        socket.emit('gameInit', {
            playerId: socket.id,
            player: player.toJSON(),
            playerData: playerData,
            players: gameManager.getAllPlayers().filter(p => p.id !== socket.id)
        });

        // Broadcast new player to all other players
        socket.broadcast.emit('playerJoined', player.toJSON());
    });

    socket.on('playerMove', (data: ScenePosition) => {
        gameManager.updatePlayerPosition(socket.id, data.x, data.y);
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: data.x,
            y: data.y
        });
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