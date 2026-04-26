import type { GameScene } from "../../GameScene";
import { SceneMinigame, type MinigameDefinition, type MinigameEndToastContext, type SceneMinigameContext } from "../Minigame";
import { TugOfWarScene } from "./TugOfWarScene";

export class TugOfWar extends SceneMinigame {
    readonly PULL_THRESHOLD = 25; //# pulls ahead to win

    pendingPulls: number;
    pulls: number;
    hasFinished: boolean;

    constructor(
        requestId: string, 
        gameScene: GameScene, 
        def: MinigameDefinition,
        sceneContext: SceneMinigameContext
    ) {
        super(requestId, gameScene, def, sceneContext);
        this.pendingPulls = 0;
        this.pulls = 0;
        this.hasFinished = false;
        this.minigameScene = new TugOfWarScene(this.def.id, this.gameScene, this);
    }

    handleInteraction(data: any): void {
        console.log("Tug of War: Handling interaction");
        (this.minigameScene as TugOfWarScene).adjustRope(-data.pendingPulls);
        this.pulls -= data.pendingPulls;
    }

    getEndToastMessage(context: MinigameEndToastContext): string {
        if (context.winnerPlayerId === null) {
            return `Tug of War ended in a tie! The rope stayed centered.`;
        }

        if (context.winnerPlayerId === context.currentPlayerId) {
            return `You beat ${context.opponentName} in Tug of War.`;
        }

        return `${context.opponentName} pulled ahead and won Tug of War.`;
    }

    pull = () => {
        if (this.hasFinished) return;
        this.pendingPulls++
        console.log('pending pulls:' + this.pendingPulls)
    };

    update() {
        if (this.hasFinished) return;

        this.gameScene.socket?.emit('minigameInteraction', 
            this.requestId,
            { pendingPulls: this.pendingPulls }
            )
        this.pulls += this.pendingPulls;
        (this.minigameScene as TugOfWarScene).adjustRope(this.pendingPulls);
        this.pendingPulls = 0;
        if (this.pulls >= this.PULL_THRESHOLD) {
            this.hasFinished = true;
            const opponentId = Array.from(this.gameScene.players.keys()).find((playerId) => playerId !== this.gameScene.currentPlayer?.playerId);
            const opponentName = opponentId ? this.gameScene.players.get(opponentId)?.playerName ?? 'Opponent' : 'Opponent';
            this.gameScene.minigameManager?.finishCurrentMinigame({
                minigameName: this.def.name,
                myScore: 1,
                opponentScore: 0,
                opponentName,
                winnerPlayerId: this.gameScene.currentPlayer?.playerId ?? null,
                currentPlayerId: this.gameScene.currentPlayer?.playerId ?? '',
                currentPlayerName: this.gameScene.currentPlayer?.playerName ?? 'You',
            });
            this.gameScene.socket?.emit('submitMinigameScore', { requestId: this.requestId, score: 1 });
        } else if (this.pulls <= -this.PULL_THRESHOLD) {
            this.hasFinished = true;
            const opponentId = Array.from(this.gameScene.players.keys()).find((playerId) => playerId !== this.gameScene.currentPlayer?.playerId);
            const opponentName = opponentId ? this.gameScene.players.get(opponentId)?.playerName ?? 'Opponent' : 'Opponent';
            this.gameScene.minigameManager?.finishCurrentMinigame({
                minigameName: this.def.name,
                myScore: 0,
                opponentScore: 1,
                opponentName,
                winnerPlayerId: opponentId ?? null,
                currentPlayerId: this.gameScene.currentPlayer?.playerId ?? '',
                currentPlayerName: this.gameScene.currentPlayer?.playerName ?? 'You',
            });
            this.gameScene.socket?.emit('submitMinigameScore', { requestId: this.requestId, score: 0 });
        }
    }
}