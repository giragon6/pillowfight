import { PlayerData, PlayerPositionData } from "./Player";
import { GameInitData } from "./server";

export interface ServerToClientEvents {
    playerLeft: (socketId: string) => void;
    playerMoved: (data: PlayerPositionData) => void;
    gameInit: (data: GameInitData) => void;
    playerJoined: (playerData: PlayerData) => void;
}

export interface ClientToServerEvents {
    playerMove: (data: PlayerPositionData) => void;
    playerCustomization: (playerData: PlayerData) => void;
}

export interface SocketData {

}
