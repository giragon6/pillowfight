import type { MinigameStartedEvent } from "../../../../server/events";
import type { GameScene } from "../../GameScene";
import { ModalMinigame, type MinigameDefinition, type MinigameEndToastContext } from "../Minigame";

export class Trivia extends ModalMinigame {
    isFinished: boolean;
    elapsedMs: number;
    iframe: HTMLIFrameElement | null;

    constructor(requestId: string, gameScene: GameScene, def: MinigameDefinition) {
        super(requestId, gameScene, def);
        this.isFinished = false;
        this.elapsedMs = 0;
        this.iframe = null;
    }

    handleInteraction(_data: any): void {
        if (_data.isFinished) {
            this.iframe!.src = '/src/game/minigames/trivia/triviasite/question1.html'
            this.finishTrivia(0);
        }
    }

    getEndToastMessage(context: MinigameEndToastContext): string {
        if (context.winnerPlayerId === null) {
            return `Trivia ended in a tie.`;
        }

        if (context.winnerPlayerId === context.currentPlayerId) {
            return `You finished trivia in ${(this.elapsedMs / 1000).toFixed(1)} seconds and beat ${context.opponentName}.`;
        }

        return `${context.opponentName} finished trivia faster than you.`;
    }

    openMinigameModal(event: MinigameStartedEvent) {
        if (!this.gameScene.currentPlayer) return;
        if (!event.playerIds.includes(this.gameScene.currentPlayer.playerId)) return;

        this.gameScene.minigameManager?.closeMinigameModal(false);

        const opponentId = event.playerIds.find((id) => id !== this.gameScene.currentPlayer!.playerId) ?? "";

        const overlay = document.createElement("div");
        overlay.className = "wager-modal-overlay minigame-overlay-fullscreen";
        overlay.style.padding = "0";

        const sec = document.createElement("div");
        this.iframe = document.createElement("iframe");
        this.iframe.className = "wager-modal-card minigame-card minigame-fullscreen-card";
        this.iframe.style.width = "96vw";
        this.iframe.style.maxWidth = "1400px";
        this.iframe.style.minHeight = "92vh";
        this.iframe.src = '/src/game/minigames/trivia/triviasite/question1.html'

        if (window.innerWidth <= 640) {
            this.iframe.style.width = "100vw";
            this.iframe.style.maxWidth = "100vw";
            this.iframe.style.minHeight = "100vh";
            this.iframe.style.borderRadius = "0";
        }

        const timerText = document.createElement("div");
        timerText.className = "minigame-hud-item minigame-timer";
        timerText.textContent = "Time elapsed: 0.0s";

        sec.appendChild(timerText);
        sec.appendChild(this.iframe);

        const progressTrack = document.createElement("div");
        progressTrack.className = "minigame-progress-track";

        overlay.appendChild(sec);
        document.body.appendChild(overlay);

        if (!this.gameScene.minigameManager) return;
        this.gameScene.minigameManager.activeMinigameModal = overlay;

        const startedAt = Date.now();
        this.gameScene.minigameManager.activeMinigameTimer = window.setInterval(() => {
            this.elapsedMs = Date.now() - startedAt;
            timerText.textContent = `Time elapsed: ${(this.elapsedMs / 1000).toFixed(1)}s`;
            if (this.isFinished) {
                clearInterval(this.gameScene.minigameManager!.activeMinigameTimer!);
            }
        }, 100);

        window.onmessage = (e) => {
            if (e.data == 'triviaComplete') {
                this.gameScene.socket?.emit('minigameInteraction', this.requestId, { "isFinished": true })
                this.finishTrivia(1);
            }
        }
    }

    finishTrivia(score: number) {
        this.isFinished = true;
        this.gameScene.minigameManager!.currentMinigameScore = score;
        this.gameScene.minigameManager?.submitMinigameScore();
        console.log('trivia finished');
    }
}
