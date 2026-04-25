import { GameManager } from "./GameManager";
import { ServerTileMapManager } from "./ServerTileMapManager";
import type { PlayerData, PlayerJSON } from "../shared/types/playerTypes";
import express from 'express';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, WagerRequestEvent } from "./events";
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
const tileMapManager = new ServerTileMapManager(150, 150); // Match client dimensions
const pendingWagerRequests = new Map<string, WagerRequestEvent>();

//todo: move this
export type GameInitData = {playerId: string, player: PlayerJSON, playerData: PlayerData, players: PlayerJSON[]};

// Set up tile change callbacks to emit to all connected clients
tileMapManager.onTileChange((x, y, tile) => {
    io.emit('tileUpdated', {
        x,
        y,
        faction: tile.faction,
        owner: tile.owner,
        contents: tile.contents,
    });
});

tileMapManager.onBatchChange((changes) => {
    const tilesData = changes.map(({x, y, tile}) => ({
        x,
        y,
        faction: tile.faction,
        owner: tile.owner,
        contents: tile.contents,
    }));
    io.emit('tilesUpdated', tilesData);
});

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

    socket.on('sendWagerRequest', (data) => {
        const sender = gameManager.getPlayer(socket.id);
        const recipientSocket = io.sockets.sockets.get(data.toPlayerId);

        if (!sender || !recipientSocket || data.toPlayerId === socket.id) {
            console.log('Wager request dropped:', {
                from: socket.id,
                to: data.toPlayerId,
                hasSender: !!sender,
                hasRecipientSocket: !!recipientSocket,
            });
            return;
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const requestEvent: WagerRequestEvent = {
            requestId,
            fromPlayerId: socket.id,
            fromUsername: sender.username,
            toPlayerId: data.toPlayerId,
            minigameId: data.minigameId,
            minigameName: data.minigameName,
            stake: data.stake,
        };

        pendingWagerRequests.set(requestId, requestEvent);
        recipientSocket.emit('wagerRequestReceived', requestEvent);
    });

    socket.on('sendWagerResponse', (data) => {
        const pendingRequest = pendingWagerRequests.get(data.requestId);
        if (!pendingRequest) {
            return;
        }

        if (pendingRequest.toPlayerId !== socket.id || pendingRequest.fromPlayerId !== data.fromPlayerId) {
            return;
        }

        const result = {
            requestId: pendingRequest.requestId,
            fromPlayerId: pendingRequest.fromPlayerId,
            toPlayerId: pendingRequest.toPlayerId,
            accepted: data.accepted,
            minigameId: pendingRequest.minigameId,
            minigameName: pendingRequest.minigameName,
        };

        io.to(pendingRequest.fromPlayerId).emit('wagerRequestResult', result);
        io.to(pendingRequest.toPlayerId).emit('wagerRequestResult', result);
        pendingWagerRequests.delete(data.requestId);
    });

    //todo: handle this (show game UI)
    socket.on('gameSceneReady', () => {

    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        for (const [requestId, request] of pendingWagerRequests.entries()) {
            if (request.fromPlayerId === socket.id || request.toPlayerId === socket.id) {
                pendingWagerRequests.delete(requestId);
            }
        }
                
        // Remove player and broadcast
        gameManager.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});