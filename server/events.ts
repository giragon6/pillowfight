import type { PlayerData, PlayerJSON, PlayerPositionData } from "../shared/types/playerTypes";
import type { GameInitData } from "./server";
import type { ScenePosition } from "../src/game/types"
import type { Faction } from "../shared/types/factions";

export interface ServerToClientEvents {
    playerLeft: (socketId: string) => void;
    playerMoved: (data: PlayerPositionData) => void;
    gameInit: (data: GameInitData) => void;
    playerJoined: (playerJson: PlayerJSON, playerData: PlayerData) => void;
    tileUpdated: (data: {x: number, y: number, faction?: Faction | undefined, owner?: string | undefined, contents?: any[]}) => void;
    tilesUpdated: (tiles: Array<{x: number, y: number, faction?: Faction | undefined, owner?: string | undefined, contents?: any[]}>) => void;
}

export interface ClientToServerEvents {
    playerMove: (data: ScenePosition ) => void;
    playerCustomization: (playerData: PlayerData) => void;
    gameSceneReady: () => void;
}

export interface SocketData {

}
