import type { GameScene } from "../../GameScene";
import { Minigame, type MinigameDefinition } from "../Minigame";

export class TugOfWar extends Minigame {
    readonly PULL_THRESHOLD = 25; //# pulls ahead to win

    pendingPulls: number;
    pulls: number;

    constructor(
        requestId: string, 
        gameScene: GameScene, 
        def: MinigameDefinition
    ) {
        super(requestId, gameScene, def);
        this.pendingPulls = 0;
        this.pulls = 0;
    }

    setupSocketListeners() {
        this.gameScene.socket?.on('minigameInteracted', (requestId, data) => {
            if (this.requestId === requestId) {
                this.pulls -= data.pendingPulls;
            }
        })
    }

    pull = () => this.pendingPulls++;

    update() {
        this.gameScene.socket?.emit('minigameInteraction', 
            this.requestId,
            {numberPulls: this.pendingPulls}
            )
        this.pulls += this.pendingPulls;
        this.pendingPulls = 0;
        if (this.pulls >= this.PULL_THRESHOLD) {
            this.gameScene.socket?.emit('submitMinigameScore',
                {requestId: this.requestId, score: 1})
            this.endMinigame();
        } else if (this.pulls <= -this.PULL_THRESHOLD) {
            this.gameScene.socket?.emit('submitMinigameScore',
                {requestId: this.requestId, score: 0})
            this.endMinigame();
        }
    }

    endMinigame() {
        this.gameScene.socket?.off('minigameInteracted');
    }
}