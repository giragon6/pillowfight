import type { MinigameStartedEvent } from "../../../../server/events";
import { ModalMinigame, type MinigameEndToastContext } from "../Minigame";
import { getMinigameUiConfig } from "./pillowSmashConfig";

const pillowSmashImage = new URL("./pillow.jpg", import.meta.url).href;

export class PillowSmash extends ModalMinigame {
    handleInteraction(_data: any): void {
        // Pillow Smash is local click scoring only.
    }

    getEndToastMessage(context: MinigameEndToastContext): string {
        if (context.winnerPlayerId === null) {
            return `Pillow Smash ended in a tie at ${context.myScore}-${context.opponentScore}. Nobody landed the final pillow blow.`;
        }

        if (context.winnerPlayerId === context.currentPlayerId) {
            return `You smashed ${context.myScore} pillows and beat ${context.opponentName} ${context.myScore}-${context.opponentScore}.`;
        }

        return `${context.opponentName} out-smashed you ${context.opponentScore}-${context.myScore}.`;
    }

    openMinigameModal(event: MinigameStartedEvent) {
        if (!this.gameScene.currentPlayer) return;
        if (!event.playerIds.includes(this.gameScene.currentPlayer.playerId)) return;

        this.gameScene.minigameManager?.closeMinigameModal(false);

        const opponentId = event.playerIds.find((id) => id !== this.gameScene.currentPlayer!.playerId) ?? "";
        const opponentName = this.gameScene.players.get(opponentId)?.playerName ?? "Opponent";

        const minigameUi = getMinigameUiConfig(event.minigameId);

        const overlay = document.createElement("div");
        overlay.className = "wager-modal-overlay minigame-overlay-fullscreen";
        overlay.style.padding = "0";

        const card = document.createElement("section");
        card.className = "wager-modal-card minigame-card minigame-fullscreen-card";
        card.style.width = "96vw";
        card.style.maxWidth = "1400px";
        card.style.minHeight = "92vh";
        card.style.padding = "clamp(24px, 3.2vw, 44px)";
        card.style.borderRadius = "28px";

        if (window.innerWidth <= 640) {
            card.style.width = "100vw";
            card.style.maxWidth = "100vw";
            card.style.minHeight = "100vh";
            card.style.borderRadius = "0";
            card.style.padding = "16px";
        }

        const pill = document.createElement("span");
        pill.className = "wager-modal-pill";
        pill.textContent = minigameUi.pillText;

        const title = document.createElement("h2");
        title.className = "wager-modal-title";
        title.textContent = `${event.minigameName} vs ${opponentName}`;

        const copy = document.createElement("p");
        copy.className = "wager-modal-copy minigame-subtitle";
        copy.textContent = minigameUi.instructions;

        const hud = document.createElement("div");
        hud.className = "minigame-hud";

        const timerText = document.createElement("div");
        timerText.className = "minigame-hud-item minigame-timer";
        timerText.textContent = "Time left: 5.0s";

        const scoreText = document.createElement("div");
        scoreText.className = "minigame-hud-item minigame-score";
        scoreText.textContent = "Your score: 0";

        hud.appendChild(timerText);
        hud.appendChild(scoreText);

        const progressTrack = document.createElement("div");
        progressTrack.className = "minigame-progress-track";
        const progressFill = document.createElement("div");
        progressFill.className = "minigame-progress-fill";
        progressTrack.appendChild(progressFill);

        const smashTarget = document.createElement("img");
        smashTarget.className = "minigame-smash-image";
        smashTarget.alt = "Pillow Smash target";
        smashTarget.draggable = false;
        smashTarget.loading = "eager";
        smashTarget.decoding = "sync";
        smashTarget.src = pillowSmashImage;
        smashTarget.onclick = () => {
            if (this.gameScene.minigameManager?.hasSubmittedMinigameScore) return;
            this.gameScene.minigameManager!.currentMinigameScore += 1;
            scoreText.textContent = `Your score: ${this.gameScene.minigameManager!.currentMinigameScore}`;
            smashTarget.classList.remove("smash-hit");
            void smashTarget.offsetWidth;
            smashTarget.classList.add("smash-hit");
        };

        const arena = document.createElement("div");
        arena.className = "minigame-arena";
        arena.appendChild(smashTarget);

        card.appendChild(pill);
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(hud);
        card.appendChild(progressTrack);
        card.appendChild(arena);

        card.querySelectorAll("button").forEach((buttonNode) => {
            buttonNode.remove();
        });

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        if (!this.gameScene.minigameManager) return;
        this.gameScene.minigameManager.activeMinigameModal = overlay;

        const startedAt = Date.now();
        this.gameScene.minigameManager.activeMinigameTimer = window.setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, 5000 - elapsedMs);
            timerText.textContent = `Time left: ${(remainingMs / 1000).toFixed(1)}s`;
            const elapsedRatio = Math.min(1, elapsedMs / 5000);
            progressFill.style.width = `${(1 - elapsedRatio) * 100}%`;
        }, 100);

        this.gameScene.minigameManager.activeMinigameDurationTimer = window.setTimeout(() => {
            this.gameScene.minigameManager?.submitMinigameScore();
            smashTarget.classList.add("smash-disabled");
            smashTarget.style.pointerEvents = "none";
            smashTarget.title = minigameUi.waitingLabel;
            timerText.textContent = "Time left: 0.0s";
            progressFill.style.width = "0%";
        }, 5000);
    }
}
