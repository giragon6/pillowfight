export type PlayerJSON = {
    id: string;
    username: string;
}

export type PlayerData = {
    username: string;
}

export type PlayerPositionData = {
    playerId: string;
    x: number;
    y: number;
}

export default class Player {
    id: string;
    username: string;

    constructor(socketId: string, x: number, y: number, playerData: PlayerData) {
        this.id = socketId;
        this.username = "pancake";
    }

    updatePlayerData(newData: PlayerData) {

    }

    updatePosition(newX: number, newY: number) {

    }

    toJSON() {
        return { id: this.id, username: this.username };
    }
}