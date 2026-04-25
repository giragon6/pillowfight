import type { PlayerData, PlayerJSON, PlayerPositionData } from "../shared/types/playerTypes";
import type { GameInitData } from "./server";
import type { ScenePosition } from "../src/game/types"
import type { Faction } from "../shared/types/factions";

export type WagerRequestPayload = {
    toPlayerId: string;
    minigameId: string;
    minigameName: string;
    betTiles: number;
};

export type WagerRequestEvent = {
    requestId: string;
    fromPlayerId: string;
    fromUsername: string;
    toPlayerId: string;
    minigameId: string;
    minigameName: string;
};

export type WagerResponsePayload = {
    requestId: string;
    fromPlayerId: string;
    accepted: boolean;
    betTiles?: number;
};

export type WagerResultEvent = {
    requestId: string;
    fromPlayerId: string;
    toPlayerId: string;
    accepted: boolean;
    minigameId: string;
    minigameName: string;
    reason?: string;
};

export type MinigameStartedEvent = {
    requestId: string;
    minigameId: string;
    minigameName: string;
    playerIds: [string, string];
};

export type MinigameScorePayload = {
    requestId: string;
    score: number;
};

export type MinigameCompletedEvent = {
    requestId: string;
    minigameId: string;
    minigameName: string;
    winnerPlayerId: string | null;
    scores: Array<{ playerId: string; score: number }>;
};

export interface ServerToClientEvents {
    playerLeft: (socketId: string) => void;
    playerMoved: (data: PlayerPositionData) => void;
    gameInit: (data: GameInitData) => void;
    playerJoined: (playerJson: PlayerJSON, playerData: PlayerData) => void;
    wagerRequestReceived: (data: WagerRequestEvent) => void;
    wagerRequestResult: (data: WagerResultEvent) => void;
    minigameStarted: (data: MinigameStartedEvent) => void;
    minigameCompleted: (data: MinigameCompletedEvent) => void;
    tileUpdated: (data: {x: number, y: number, faction?: Faction | undefined, owner?: string | undefined, contents?: any[]}) => void;
    tilesUpdated: (tiles: Array<{x: number, y: number, faction?: Faction | undefined, owner?: string | undefined, contents?: any[]}>) => void;
}

export interface ClientToServerEvents {
    playerMove: (data: ScenePosition ) => void;
    playerCustomization: (playerData: PlayerData) => void;
    gameSceneReady: () => void;
    sendWagerRequest: (data: WagerRequestPayload) => void;
    sendWagerResponse: (data: WagerResponsePayload) => void;
    submitMinigameScore: (data: MinigameScorePayload) => void;
}

export interface SocketData {

}
