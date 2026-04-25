import type { PlayerData, PlayerJSON, PlayerPositionData } from "../shared/types/playerTypes";
import type { GameInitData } from "./server";
import type { ScenePosition } from "../src/game/types"
import type { TileData } from "./TilemapManager";

export type WagerRequestPayload = {
    toPlayerId: string;
    minigameId: string;
    minigameName: string;
    stake: string;
};

export type WagerRequestEvent = {
    requestId: string;
    fromPlayerId: string;
    fromUsername: string;
    toPlayerId: string;
    minigameId: string;
    minigameName: string;
    stake: string;
};

export type WagerResponsePayload = {
    requestId: string;
    fromPlayerId: string;
    accepted: boolean;
};

export type WagerResultEvent = {
    requestId: string;
    fromPlayerId: string;
    toPlayerId: string;
    accepted: boolean;
    minigameId: string;
    minigameName: string;
};

export interface ServerToClientEvents {
    playerLeft: (socketId: string) => void;
    playerMoved: (data: PlayerPositionData) => void;
    gameInit: (data: GameInitData) => void;
    playerJoined: (playerJson: PlayerJSON, playerData: PlayerData) => void;
    tileUpdated: (data: TileData) => void;
    tilesUpdated: (tiles: TileData[]) => void;
    tilesClaimed: (tiles: TileData[]) => void;
    tilesUnclaimed: (tiles: TileData[]) => void;
    wagerRequestReceived: (data: WagerRequestEvent) => void;
    wagerRequestResult: (data: WagerResultEvent) => void;
}

export interface ClientToServerEvents {
    playerMove: (data: ScenePosition ) => void;
    playerCustomization: (playerData: PlayerData) => void;
    gameSceneReady: () => void;
    tileUpdate: (data: { x: number; y: number; index: number; properties?: Record<string, any> }) => void;
    tilesUpdate: (tiles: Array<{ x: number; y: number; index: number; properties?: Record<string, any> }>) => void;
    claimTiles: (tiles: Array<{ x: number; y: number }>) => void;
    unclaimTiles: (tiles: Array<{ x: number; y: number }>) => void;
    sendWagerRequest: (data: WagerRequestPayload) => void;
    sendWagerResponse: (data: WagerResponsePayload) => void;
}

export interface SocketData {

}
