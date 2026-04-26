import { GameManager } from "./GameManager";
import type { PlayerData, PlayerJSON } from "../shared/types/playerTypes";
import type { Faction } from "../shared/types/factions";
import express from 'express';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, WagerRequestEvent } from "./events";
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ScenePosition } from "../src/game/types";
import { TILE_INDICES, type TileData } from "./TilemapManager";

const app = express();
const httpServer = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

app.use(express.static(distPath));

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData
>(httpServer, {
    cors: {
        origin: '*'
    },
    // Detect dropped tabs quickly so stale players are cleaned up.
    pingInterval: 5000,
    pingTimeout: 5000,
});

const gameManager = new GameManager();

function buildFactionLeaderboard() {
    const counts = {
        Lavender: 0,
        Yellow: 0,
        Blue: 0,
        Pink: 0,
    };
    const characterCounts = new Map<string, number>();

    const allTiles = gameManager.getTilemap().getAllTiles();
    allTiles.forEach((tile) => {
        if (tile.index === TILE_INDICES.LAVENDER) counts.Lavender += 1;
        if (tile.index === TILE_INDICES.YELLOW) counts.Yellow += 1;
        if (tile.index === TILE_INDICES.BLUE) counts.Blue += 1;
        if (tile.index === TILE_INDICES.PINK) counts.Pink += 1;

        if (tile.index > TILE_INDICES.EMPTY) {
            const ownerId = tile.properties?.owner as string | undefined;
            if (ownerId) {
                const avatarKey = gameManager.getPlayer(ownerId)?.avatar ?? 'Unknown';
                characterCounts.set(avatarKey, (characterCounts.get(avatarKey) ?? 0) + 1);
            }
        }
    });

    const claimedTiles = counts.Lavender + counts.Yellow + counts.Blue + counts.Pink;
    const factions = (Object.entries(counts) as Array<[Faction, number]>)
        .map(([faction, tiles]) => ({
            faction,
            tiles,
            percentage: claimedTiles === 0 ? 0 : Number(((tiles / claimedTiles) * 100).toFixed(2)),
        }))
        .sort((a, b) => b.tiles - a.tiles);
    const characters = Array.from(characterCounts.entries())
        .map(([avatarKey, tiles]) => ({
            avatarKey,
            tiles,
            percentage: claimedTiles === 0 ? 0 : Number(((tiles / claimedTiles) * 100).toFixed(2)),
        }))
        .sort((a, b) => b.tiles - a.tiles);

    return {
        claimedTiles,
        totalTiles: allTiles.length,
        factions,
        characters,
        updatedAt: Date.now(),
    };
}

app.get('/api/leaderboard', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(buildFactionLeaderboard());
});

app.get('/leaderboard', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Spawn patch size for each player (5x5 by default)
const SPAWN_PATCH_SIZE = 5;
type PendingWagerSession = WagerRequestEvent;

const pendingWagerSessions = new Map<string, PendingWagerSession>();
const activeMinigames = new Map<
    string,
    {
        requestId: string;
        minigameId: string;
        minigameName: string;
        players: [string, string];
        playerFactions: Record<string, Faction>;
        betByPlayer: Record<string, number>;
        totalBetTiles: number;
        scores: Map<string, number>;
    }
>();

function sanitizeBetTiles(value: number) {
    return Math.floor(value);
}

function isBetInAllowedRange(value: number) {
    return Number.isInteger(value) && value >= 5;
}

function getOwnedTileCount(playerId: string) {
    return gameManager.getTilesByOwner(playerId).length;
}

function getReferenceTile(playerId: string) {
    const tilemap = gameManager.getTilemap();
    const player = gameManager.getPlayer(playerId);

    if (!player) {
        return {
            x: Math.floor(tilemap.width / 2),
            y: Math.floor(tilemap.height / 2),
        };
    }

    const x = Math.max(0, Math.min(tilemap.width - 1, Math.floor(player.x / tilemap.tileWidth)));
    const y = Math.max(0, Math.min(tilemap.height - 1, Math.floor(player.y / tilemap.tileHeight)));
    return { x, y };
}

function distanceFromReference(tile: TileData, ref: { x: number; y: number }) {
    return (tile.x - ref.x) ** 2 + (tile.y - ref.y) ** 2;
}

function getLoserTilesToUnclaim(loserPlayerId: string, tileCount: number): Array<{ x: number; y: number }> {
    if (tileCount <= 0) {
        return [];
    }

    const loserRef = getReferenceTile(loserPlayerId);
    const ownedTiles = gameManager.getTilesByOwner(loserPlayerId);
    const maxRemovableTiles = Math.max(0, ownedTiles.length - 1);
    const tilesToRemove = Math.min(tileCount, maxRemovableTiles);

    if (tilesToRemove <= 0) {
        return [];
    }

    return ownedTiles
        .sort((a, b) => distanceFromReference(a, loserRef) - distanceFromReference(b, loserRef))
        .slice(0, tilesToRemove)
        .map((tile) => ({ x: tile.x, y: tile.y }));
}

function getEmptyTilesToClaim(winnerPlayerId: string, tileCount: number): Array<{ x: number; y: number }> {
    if (tileCount <= 0) {
        return [];
    }

    const winnerRef = getReferenceTile(winnerPlayerId);
    return gameManager
        .getTilemap()
        .getAllTiles()
        // Use tile index as the source of truth for emptiness to avoid
        // overwriting colored territory when metadata is missing.
        .filter((tile) => tile.index === TILE_INDICES.EMPTY)
        .sort((a, b) => distanceFromReference(a, winnerRef) - distanceFromReference(b, winnerRef))
        .slice(0, tileCount)
        .map((tile) => ({ x: tile.x, y: tile.y }));
}

function ensurePlayerHasAtLeastOneTile(playerId: string, faction: Faction) {
    const ownedTiles = gameManager.getTilesByOwner(playerId);
    if (ownedTiles.length > 0) {
        return;
    }

    const fallbackTile = getEmptyTilesToClaim(playerId, 1);
    if (fallbackTile.length === 0) {
        return;
    }

    const claimedTiles = gameManager.getTilemap().claimTiles(playerId, faction, fallbackTile);
    if (claimedTiles.length > 0) {
        io.emit('tilesClaimed', claimedTiles);
    }
}

function removePlayerAndTerritory(playerId: string) {
    const ownedTiles = gameManager.getTilesByOwner(playerId);
    if (ownedTiles.length > 0) {
        const unclaimedTiles = gameManager.unclaimTiles(
            ownedTiles.map((tile) => ({ x: tile.x, y: tile.y }))
        );
        if (unclaimedTiles.length > 0) {
            io.emit('tilesUnclaimed', unclaimedTiles);
        }
    }

    gameManager.removePlayer(playerId);
    io.emit('playerLeft', playerId);
}

function pruneStalePlayers() {
    const activeSocketIds = new Set(io.sockets.sockets.keys());
    const stalePlayerIds = gameManager
        .getAllPlayers()
        .map((player) => player.id)
        .filter((playerId) => !activeSocketIds.has(playerId));

    for (const stalePlayerId of stalePlayerIds) {
        removePlayerAndTerritory(stalePlayerId);

        for (const [requestId, request] of pendingWagerSessions.entries()) {
            if (request.fromPlayerId === stalePlayerId || request.toPlayerId === stalePlayerId) {
                pendingWagerSessions.delete(requestId);
            }
        }

        for (const [sessionId, session] of activeMinigames.entries()) {
            if (session.players.includes(stalePlayerId)) {
                activeMinigames.delete(sessionId);
            }
        }
    }
}

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
    pruneStalePlayers();

    socket.on('playerCustomization', (playerData: PlayerData) => {
        console.log('Received player customization:', playerData);
        pruneStalePlayers();
        
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

    socket.on('sendWagerRequest', (data) => {
        const sender = gameManager.getPlayer(socket.id);
        const recipientSocket = io.sockets.sockets.get(data.toPlayerId);
        const challengerBetTiles = sanitizeBetTiles(data.betTiles);
        const challengerOwnedTiles = getOwnedTileCount(socket.id);
        const opponentOwnedTiles = getOwnedTileCount(data.toPlayerId);

        if (!sender || !recipientSocket || data.toPlayerId === socket.id) {
            console.log('Wager request dropped:', {
                from: socket.id,
                to: data.toPlayerId,
                hasSender: !!sender,
                hasRecipientSocket: !!recipientSocket,
            });
            return;
        }

        if (!isBetInAllowedRange(challengerBetTiles)) {
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

        if (challengerBetTiles > challengerOwnedTiles) {
            socket.emit('wagerRequestResult', {
                requestId: '',
                fromPlayerId: socket.id,
                toPlayerId: data.toPlayerId,
                accepted: false,
                minigameId: data.minigameId,
                minigameName: data.minigameName,
                reason: `You can bet at most ${challengerOwnedTiles} tiles right now.`,
            });
            return;
        }

        if (challengerBetTiles > opponentOwnedTiles) {
            socket.emit('wagerRequestResult', {
                requestId: '',
                fromPlayerId: socket.id,
                toPlayerId: data.toPlayerId,
                accepted: false,
                minigameId: data.minigameId,
                minigameName: data.minigameName,
                reason: `Opening wager cannot exceed your opponent's ${opponentOwnedTiles} tiles.`,
            });
            return;
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const requestEvent: PendingWagerSession = {
            requestId,
            fromPlayerId: socket.id,
            fromUsername: sender.username,
            toPlayerId: data.toPlayerId,
            minigameId: data.minigameId,
            minigameName: data.minigameName,
            currentBetTiles: challengerBetTiles,
            nextActorPlayerId: data.toPlayerId,
        };

        pendingWagerSessions.set(requestId, requestEvent);
        recipientSocket.emit('wagerRequestReceived', {
            ...requestEvent,
        });

        io.to(socket.id).emit('wagerNegotiationUpdated', {
            ...requestEvent,
        });
    });

    socket.on('sendWagerAction', (data) => {
        const pendingSession = pendingWagerSessions.get(data.requestId);
        if (!pendingSession) {
            return;
        }

        const players = [pendingSession.fromPlayerId, pendingSession.toPlayerId] as [string, string];
        if (!players.includes(socket.id)) {
            return;
        }

        if (pendingSession.nextActorPlayerId !== socket.id) {
            socket.emit('wagerRequestResult', {
                requestId: pendingSession.requestId,
                fromPlayerId: pendingSession.fromPlayerId,
                toPlayerId: pendingSession.toPlayerId,
                accepted: false,
                minigameId: pendingSession.minigameId,
                minigameName: pendingSession.minigameName,
                reason: 'Wait for your turn to act on this wager.',
            });
            return;
        }

        const otherPlayerId = players.find((playerId) => playerId !== socket.id)!;

        if (data.action === 'decline') {
            const declinedResult = {
                requestId: pendingSession.requestId,
                fromPlayerId: pendingSession.fromPlayerId,
                toPlayerId: pendingSession.toPlayerId,
                accepted: false,
                minigameId: pendingSession.minigameId,
                minigameName: pendingSession.minigameName,
                reason: socket.id === pendingSession.fromPlayerId
                    ? `${pendingSession.fromUsername} declined the wager.`
                    : 'Opponent declined the wager.',
            };

            io.to(pendingSession.fromPlayerId).emit('wagerRequestResult', declinedResult);
            io.to(pendingSession.toPlayerId).emit('wagerRequestResult', declinedResult);
            pendingWagerSessions.delete(data.requestId);
            return;
        }

        if (data.action === 'raise') {
            const raisedBetTiles = sanitizeBetTiles(data.betTiles ?? 0);
            const raiserOwnedTiles = getOwnedTileCount(socket.id);
            const otherOwnedTiles = getOwnedTileCount(otherPlayerId);
            const maxAllowedRaise = Math.min(raiserOwnedTiles, otherOwnedTiles);

            if (!isBetInAllowedRange(raisedBetTiles)) {
                socket.emit('wagerRequestResult', {
                    requestId: pendingSession.requestId,
                    fromPlayerId: pendingSession.fromPlayerId,
                    toPlayerId: pendingSession.toPlayerId,
                    accepted: false,
                    minigameId: pendingSession.minigameId,
                    minigameName: pendingSession.minigameName,
                    reason: 'Your raise must be a whole number and minimum 5.',
                });
                return;
            }

            if (raisedBetTiles <= pendingSession.currentBetTiles) {
                socket.emit('wagerRequestResult', {
                    requestId: pendingSession.requestId,
                    fromPlayerId: pendingSession.fromPlayerId,
                    toPlayerId: pendingSession.toPlayerId,
                    accepted: false,
                    minigameId: pendingSession.minigameId,
                    minigameName: pendingSession.minigameName,
                    reason: `Raise must be greater than current wager (${pendingSession.currentBetTiles}).`,
                });
                return;
            }

            if (raisedBetTiles > maxAllowedRaise) {
                socket.emit('wagerRequestResult', {
                    requestId: pendingSession.requestId,
                    fromPlayerId: pendingSession.fromPlayerId,
                    toPlayerId: pendingSession.toPlayerId,
                    accepted: false,
                    minigameId: pendingSession.minigameId,
                    minigameName: pendingSession.minigameName,
                    reason: `You can raise to at most ${maxAllowedRaise} tiles based on both players' territory.`,
                });
                return;
            }

            pendingSession.currentBetTiles = raisedBetTiles;
            pendingSession.nextActorPlayerId = otherPlayerId;

            const updateEvent: WagerRequestEvent = {
                ...pendingSession,
                raisedByPlayerId: socket.id,
            };
            io.to(pendingSession.fromPlayerId).emit('wagerNegotiationUpdated', updateEvent);
            io.to(pendingSession.toPlayerId).emit('wagerNegotiationUpdated', updateEvent);
            return;
        }

        if (data.action !== 'call') {
            return;
        }

        const result = {
            requestId: pendingSession.requestId,
            fromPlayerId: pendingSession.fromPlayerId,
            toPlayerId: pendingSession.toPlayerId,
            accepted: true,
            minigameId: pendingSession.minigameId,
            minigameName: pendingSession.minigameName,
        };

        io.to(pendingSession.fromPlayerId).emit('wagerRequestResult', result);
        io.to(pendingSession.toPlayerId).emit('wagerRequestResult', result);

        const fromPlayer = gameManager.getPlayer(pendingSession.fromPlayerId);
        const toPlayer = gameManager.getPlayer(pendingSession.toPlayerId);
        if (!fromPlayer || !toPlayer) {
            pendingWagerSessions.delete(data.requestId);
            return;
        }

        const minigameSession = {
            requestId: pendingSession.requestId,
            minigameId: pendingSession.minigameId,
            minigameName: pendingSession.minigameName,
            players: [fromPlayer.id, toPlayer.id] as [string, string],
            playerFactions: {
                [fromPlayer.id]: fromPlayer.faction,
                [toPlayer.id]: toPlayer.faction,
            },
            betByPlayer: {
                [fromPlayer.id]: pendingSession.currentBetTiles,
                [toPlayer.id]: pendingSession.currentBetTiles,
            },
            totalBetTiles: pendingSession.currentBetTiles * 2,
            scores: new Map<string, number>(),
        };

        activeMinigames.set(minigameSession.requestId, minigameSession);

        io.to(minigameSession.players[0]).emit('minigameStarted', {
            requestId: minigameSession.requestId,
            minigameId: minigameSession.minigameId,
            minigameName: minigameSession.minigameName,
            playerIds: minigameSession.players,
        });
        io.to(minigameSession.players[1]).emit('minigameStarted', {
            requestId: minigameSession.requestId,
            minigameId: minigameSession.minigameId,
            minigameName: minigameSession.minigameName,
            playerIds: minigameSession.players,
        });

        pendingWagerSessions.delete(data.requestId);
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

        if (winnerPlayerId) {
            const loserPlayerId = session.players.find((playerId) => playerId !== winnerPlayerId);
            if (loserPlayerId) {
                const loserBetTiles = session.betByPlayer[loserPlayerId] ?? 0;
                const loserTilesToUnclaim = getLoserTilesToUnclaim(loserPlayerId, loserBetTiles);
                if (loserTilesToUnclaim.length > 0) {
                    const unclaimedTiles = gameManager.unclaimTiles(loserTilesToUnclaim);
                    if (unclaimedTiles.length > 0) {
                        io.emit('tilesUnclaimed', unclaimedTiles);
                    }
                }

                const loserFaction = session.playerFactions[loserPlayerId];
                if (loserFaction) {
                    ensurePlayerHasAtLeastOneTile(loserPlayerId, loserFaction);
                }
            }

            const awardCoordinates = getEmptyTilesToClaim(winnerPlayerId, session.totalBetTiles);
            if (awardCoordinates.length > 0) {
                const winnerFaction = session.playerFactions[winnerPlayerId];
                const awardedTiles = winnerFaction
                    ? gameManager.getTilemap().claimTiles(winnerPlayerId, winnerFaction, awardCoordinates)
                    : [];
                if (awardedTiles.length > 0) {
                    io.emit('tilesClaimed', awardedTiles);
                }
            }
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

    socket.on('minigameInteraction', (requestId, data) => {
        const session = activeMinigames.get(requestId);
        if (!session) {
            return;
        }

        if (!session.players.includes(socket.id)) {
            return;
        }

        const opponentId = session.players.find((playerId) => playerId !== socket.id);
        if (!opponentId) {
            return;
        }

        io.to(opponentId).emit('minigameInteracted', requestId, data);
    });

    //todo: handle this (show game UI)
    socket.on('gameSceneReady', () => {

    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        for (const [requestId, request] of pendingWagerSessions.entries()) {
            if (request.fromPlayerId === socket.id || request.toPlayerId === socket.id) {
                pendingWagerSessions.delete(requestId);
            }
        }

        for (const [sessionId, session] of activeMinigames.entries()) {
            if (session.players.includes(socket.id)) {
                activeMinigames.delete(sessionId);
            }
        }
                
        // Remove player and clear their claimed territory.
        removePlayerAndTerritory(socket.id);
        pruneStalePlayers();
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});