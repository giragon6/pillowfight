import type { MinigameCompletedEvent, MinigameStartedEvent } from "../../../server/events";
import type { GameScene } from "../GameScene";
import { ModalMinigame, SceneMinigame, type MinigameDefinition, type MinigameEndToastContext, type SceneMinigameContext } from "./Minigame";
import type { MinigameScene } from "./MinigameScene";
import { PillowSmash } from "./pillowSmash/PillowSmash";
import { Trivia } from "./trivia/Trivia";
import { TugOfWar } from "./tugOfWar/TugOfWar";

export default class MinigameManager {
    activeMinigameModal: HTMLDivElement | null;
    activeMinigameTimer: number | null;
    activeMinigameDurationTimer: number | null;
    currentMinigameScore: number;
    currentMinigameRequestId: string | null;
    hasSubmittedMinigameScore: boolean;

    activeMinigame: ModalMinigame | SceneMinigame | null; 

    gameScene: GameScene;

    constructor(gameScene: GameScene) {
        this.gameScene = gameScene;

        this.activeMinigameModal = null;
        this.activeMinigameTimer = null;
        this.activeMinigameDurationTimer = null;
        this.currentMinigameScore = 0;
        this.currentMinigameRequestId = null;
        this.hasSubmittedMinigameScore = false;
        this.activeMinigame = null;

        this.setupSocketListeners();
    }

    getActiveMinigameType(): 'modal' | 'scene' | null {
        if (!this.activeMinigame) return null;
        if (this.activeMinigame instanceof ModalMinigame) return 'modal';
        return 'scene';
    }

    createMinigameForEvent(event: MinigameStartedEvent): ModalMinigame | SceneMinigame | null {
        const def: MinigameDefinition = {
            id: event.minigameId,
            name: event.minigameName,
            description: '',
        };

        const currentPlayer = this.gameScene.currentPlayer;
        const opponentId = event.playerIds.find((playerId) => playerId !== currentPlayer?.playerId) ?? '';
        const opponent = opponentId ? this.gameScene.players.get(opponentId) : null;
        const sceneContext: SceneMinigameContext = {
            currentPlayerId: currentPlayer?.playerId ?? '',
            currentPlayerName: currentPlayer?.playerName ?? 'You',
            currentPlayerAvatarKey: currentPlayer?.avatarKey ?? '',
            opponentPlayerId: opponentId,
            opponentPlayerName: opponent?.playerName ?? 'Opponent',
            opponentPlayerAvatarKey: opponent?.avatarKey ?? '',
        };

        if (event.minigameId === 'pls') {
            return new PillowSmash(event.requestId, this.gameScene, def);
        }

        if (event.minigameId === 'tow') {
            return new TugOfWar(event.requestId, this.gameScene, def, sceneContext);
        }

        if (event.minigameId === 'tri') {
            return new Trivia(event.requestId, this.gameScene, def);
        }

        return null;
    }

    resetMinigameState() {
        this.currentMinigameScore = 0;
        this.currentMinigameRequestId = null;
        this.hasSubmittedMinigameScore = false;
    }

    finishCurrentMinigame(context: MinigameEndToastContext) {
        const completedMinigame = this.activeMinigame;
        const endMessage = completedMinigame?.getEndToastMessage(context);

        if (completedMinigame instanceof SceneMinigame) {
            completedMinigame.minigameScene.close();
        }

        this.closeMinigameModal(false);

        if (this.activeMinigame) {
            this.activeMinigame.disconnectSocketListeners();
            this.activeMinigame = null;
        }

        this.resetMinigameState();
        this.gameScene.showWagerToast(endMessage ?? `The ${context.minigameName} round ended.`);
    }

    handleMinigameStarted(event: MinigameStartedEvent) {
        if (!this.gameScene.currentPlayer) return;
        if (!event.playerIds.includes(this.gameScene.currentPlayer.playerId)) return;

        if (this.activeMinigame) {
            this.activeMinigame.disconnectSocketListeners();
        }

        this.activeMinigame = this.createMinigameForEvent(event);
        if (!this.activeMinigame) {
            this.gameScene.showWagerToast(`Unsupported minigame: ${event.minigameName}`);
            return;
        }

        this.currentMinigameRequestId = event.requestId;
        this.currentMinigameScore = 0;
        this.hasSubmittedMinigameScore = false;

        if (this.activeMinigame instanceof ModalMinigame) {
            this.activeMinigame.openMinigameModal(event);
            return;
        }

        if (this.activeMinigame instanceof SceneMinigame) {
            this.launchMinigameScene(this.activeMinigame.minigameScene, this.activeMinigame.def);
        }
    }

    handleMinigameCompleted(event: MinigameCompletedEvent) {
        if (!this.gameScene.currentPlayer) return;
        if (this.currentMinigameRequestId !== event.requestId) return;

        const myId = this.gameScene.currentPlayer.playerId;
        const opponentId = event.scores.find((entry) => entry.playerId !== myId)?.playerId ?? null;
        const myScore = event.scores.find((entry) => entry.playerId === myId)?.score ?? 0;
        const opponentScore = event.scores.find((entry) => entry.playerId !== myId)?.score ?? 0;
        const opponentName = opponentId ? this.gameScene.players.get(opponentId)?.playerName ?? 'Opponent' : 'Opponent';
        const toastContext: MinigameEndToastContext = {
            minigameName: event.minigameName,
            myScore,
            opponentScore,
            opponentName,
            winnerPlayerId: event.winnerPlayerId,
            currentPlayerId: myId,
            currentPlayerName: this.gameScene.currentPlayer.playerName ?? 'You',
        };

        this.finishCurrentMinigame(toastContext);
    }

    setupSocketListeners() {
        this.gameScene.socket!.on('minigameStarted', (event) => {
            this.handleMinigameStarted(event);
        });

        this.gameScene.socket!.on('minigameCompleted', (event) => {
            this.handleMinigameCompleted(event);
        });
    }

    submitMinigameScore() {
        if (this.hasSubmittedMinigameScore) return;
        if (!this.currentMinigameRequestId) return;

        this.hasSubmittedMinigameScore = true;
        this.gameScene.socket?.emit('submitMinigameScore', {
            requestId: this.currentMinigameRequestId,
            score: this.currentMinigameScore,
        });
    }

    closeMinigameModal(resetState = true) {
        if (this.activeMinigameTimer !== null) {
            window.clearInterval(this.activeMinigameTimer);
            this.activeMinigameTimer = null;
        }

        if (this.activeMinigameDurationTimer !== null) {
            window.clearTimeout(this.activeMinigameDurationTimer);
            this.activeMinigameDurationTimer = null;
        }

        if (this.activeMinigameModal) {
            this.activeMinigameModal.remove();
            this.activeMinigameModal = null;
        }

        if (resetState) {
            this.resetMinigameState();
        }
    }

    launchMinigameScene<T extends MinigameScene>(minigameScene: MinigameScene, minigameDef: MinigameDefinition): T {
        // Pause this scene so the game world stops updating
        this.gameScene.scene.pause();

        // Add and start the overlay scene instance
        const sceneKey = minigameDef.id;
        const child = this.gameScene.scene.add(sceneKey, minigameScene, true) as T;

        // Bring it above everything
        this.gameScene.scene.bringToTop(sceneKey);

        // When the overlay shuts down, resume this scene and remove the overlay
        if (child && child.events) {
            child.events.once('shutdown', () => {
                this.gameScene.scene.resume();
                try {
                    this.gameScene.scene.remove(sceneKey);
                } catch (e) {
                    // ignore
                }
            });
        }

        return child;
    }
}