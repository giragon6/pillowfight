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
const activeMinigames = new Map<
    string,
    {
        requestId: string;
        minigameId: string;
        minigameName: string;
        players: [string, string];
        scores: Map<string, number>;
    }
>();

function sanitizeBetTiles(value: number) {
    return Math.floor(value);
}

function isBetInAllowedRange(value: number) {
    return Number.isInteger(value) && value >= 5;
}

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
        const requesterBetTiles = sanitizeBetTiles(data.betTiles);

        if (!sender || !recipientSocket || data.toPlayerId === socket.id) {
            console.log('Wager request dropped:', {
                from: socket.id,
                to: data.toPlayerId,
                hasSender: !!sender,
                hasRecipientSocket: !!recipientSocket,
            });
            return;
        }

        if (!isBetInAllowedRange(requesterBetTiles)) {
            socket.emit('wagerRequestResult', {
                requestId: '',
                fromPlayerId: socket.id,
                toPlayerId: data.toPlayerId,
                accepted: false,
                minigameId: data.minigameId,
                minigameName: data.minigameName,
                reason: 'Your wager must be a whole number and minimum 5.',
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
        };

        pendingWagerRequests.set(requestId, requestEvent);
        recipientSocket.emit('wagerRequestReceived', {
            requestId,
            fromPlayerId: socket.id,
            fromUsername: sender.username,
            toPlayerId: data.toPlayerId,
            minigameId: data.minigameId,
            minigameName: data.minigameName,
        });
    });

    socket.on('sendWagerResponse', (data) => {
        const pendingRequest = pendingWagerRequests.get(data.requestId);
        if (!pendingRequest) {
            return;
        }

        if (pendingRequest.toPlayerId !== socket.id || pendingRequest.fromPlayerId !== data.fromPlayerId) {
            return;
        }

        if (!data.accepted) {
            const declinedResult = {
                requestId: pendingRequest.requestId,
                fromPlayerId: pendingRequest.fromPlayerId,
                toPlayerId: pendingRequest.toPlayerId,
                accepted: false,
                minigameId: pendingRequest.minigameId,
                minigameName: pendingRequest.minigameName,
            };

            io.to(pendingRequest.fromPlayerId).emit('wagerRequestResult', declinedResult);
            io.to(pendingRequest.toPlayerId).emit('wagerRequestResult', declinedResult);
            pendingWagerRequests.delete(data.requestId);
            return;
        }

        const responderBetTiles = sanitizeBetTiles(data.betTiles ?? 0);
        if (!isBetInAllowedRange(responderBetTiles)) {
            socket.emit('wagerRequestResult', {
                requestId: pendingRequest.requestId,
                fromPlayerId: pendingRequest.fromPlayerId,
                toPlayerId: pendingRequest.toPlayerId,
                accepted: false,
                minigameId: pendingRequest.minigameId,
                minigameName: pendingRequest.minigameName,
                reason: 'Your bet must be a whole number and minimum 5.',
            });
            return;
        }

        const result = {
            requestId: pendingRequest.requestId,
            fromPlayerId: pendingRequest.fromPlayerId,
            toPlayerId: pendingRequest.toPlayerId,
            accepted: true,
            minigameId: pendingRequest.minigameId,
            minigameName: pendingRequest.minigameName,
        };

        io.to(pendingRequest.fromPlayerId).emit('wagerRequestResult', result);
        io.to(pendingRequest.toPlayerId).emit('wagerRequestResult', result);

        const session = {
            requestId: pendingRequest.requestId,
            minigameId: pendingRequest.minigameId,
            minigameName: pendingRequest.minigameName,
            players: [pendingRequest.fromPlayerId, pendingRequest.toPlayerId] as [string, string],
            scores: new Map<string, number>(),
        };

        activeMinigames.set(session.requestId, session);

        io.to(session.players[0]).emit('minigameStarted', {
            requestId: session.requestId,
            minigameId: session.minigameId,
            minigameName: session.minigameName,
            playerIds: session.players,
        });
        io.to(session.players[1]).emit('minigameStarted', {
            requestId: session.requestId,
            minigameId: session.minigameId,
            minigameName: session.minigameName,
            playerIds: session.players,
        });

        pendingWagerRequests.delete(data.requestId);
    });

    socket.on('submitMinigameScore', (data) => {
        const session = activeMinigames.get(data.requestId);
        if (!session) {
            return;
        }

        if (!session.players.includes(socket.id)) {
            return;
        }

        session.scores.set(socket.id, data.score);

        if (session.scores.size < 2) {
            return;
        }

        const playerOneScore = session.scores.get(session.players[0]) ?? 0;
        const playerTwoScore = session.scores.get(session.players[1]) ?? 0;

        let winnerPlayerId: string | null = null;
        if (playerOneScore > playerTwoScore) {
            winnerPlayerId = session.players[0];
        } else if (playerTwoScore > playerOneScore) {
            winnerPlayerId = session.players[1];
        }

        const completedEvent = {
            requestId: session.requestId,
            minigameId: session.minigameId,
            minigameName: session.minigameName,
            winnerPlayerId,
            scores: [
                { playerId: session.players[0], score: playerOneScore },
                { playerId: session.players[1], score: playerTwoScore },
            ],
        };

        io.to(session.players[0]).emit('minigameCompleted', completedEvent);
        io.to(session.players[1]).emit('minigameCompleted', completedEvent);
        activeMinigames.delete(session.requestId);
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

        for (const [sessionId, session] of activeMinigames.entries()) {
            if (session.players.includes(socket.id)) {
                activeMinigames.delete(sessionId);
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