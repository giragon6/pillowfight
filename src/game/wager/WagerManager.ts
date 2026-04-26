import type { WagerRequestEvent, WagerResultEvent } from '../../../server/events';
import type { GameScene } from '../GameScene';
import { pickRandomMinigame } from '../minigames/Minigame';
import type PlayerSprite from '../player/PlayerSprite';

export default class WagerManager {
    gameScene: GameScene;
    activeRequestId: string | null;

    constructor(gameScene: GameScene) {
        this.gameScene = gameScene;
        this.activeRequestId = null;
    }

    private getOwnedTileCount(playerId: string) {
        return this.gameScene.gameMap.getOwnedTiles(playerId).length;
    }

    private setInlineWarning(message: string) {
        if (!this.gameScene.activeWagerModal) return;
        const helper = this.gameScene.activeWagerModal.querySelector('.wager-helper-text') as HTMLParagraphElement | null;
        if (!helper) return;
        helper.textContent = message;
    }

    openOutgoingWagerModal(targetPlayer: PlayerSprite) {
        const minigame = pickRandomMinigame();
        const opponentTileCount = this.getOwnedTileCount(targetPlayer.playerId);

        const bodyCopy = `hey ${targetPlayer.playerName}... LET'S GO GAMBLING!!!`;

        const betInput = document.createElement('input');
        betInput.className = 'wager-bet-input';
        betInput.type = 'number';
        betInput.min = '5';
        betInput.step = '1';
        betInput.value = '10';
        betInput.placeholder = 'Opening wager';

        const helperText = document.createElement('p');
        helperText.className = 'wager-helper-text';
        helperText.textContent = `Opening wager must be 5-${opponentTileCount} (opponent owned tiles).`;

        const validateOpeningBet = () => {
            const betTiles = Math.floor(Number(betInput.value));
            if (!Number.isInteger(betTiles) || betTiles < 5) {
                helperText.textContent = 'Opening wager must be a whole number and minimum 5.';
                return false;
            }
            if (betTiles > opponentTileCount) {
                helperText.textContent = `Opening wager cannot exceed opponent tiles (${opponentTileCount}).`;
                return false;
            }
            helperText.textContent = `Opening wager must be 5-${opponentTileCount} (opponent owned tiles).`;
            return true;
        };

        const modal = this.gameScene.openWagerModal({
            pill: 'Sleepover Challenge',
            title: `Challenge ${targetPlayer.playerName}?`,
            body: bodyCopy,
            customContent: [betInput, helperText],
            primaryLabel: 'Send Request',
            secondaryLabel: 'Maybe Later',
            onPrimary: () => {
                if (!validateOpeningBet()) {
                    return;
                }

                const betTiles = Math.floor(Number(betInput.value));

                this.gameScene.socket?.emit('sendWagerRequest', {
                    toPlayerId: targetPlayer.playerId,
                    minigameId: minigame.id,
                    minigameName: minigame.name,
                    betTiles,
                });
                modal.primaryButton.disabled = true;
                modal.secondaryButton.disabled = true;
                this.gameScene.showWagerToast(`Wager request sent to ${targetPlayer.playerName}.`);
            },
            onSecondary: () => {
                this.gameScene.closeWagerModal();
            },
        });

        const syncOpeningButtonState = () => {
            modal.primaryButton.disabled = !validateOpeningBet();
        };

        betInput.addEventListener('input', syncOpeningButtonState);
        syncOpeningButtonState();
    }

    handleWagerNegotiationUpdate(event: WagerRequestEvent) {
        if (!this.gameScene.currentPlayer) return;

        const myId = this.gameScene.currentPlayer.playerId;
        if (myId !== event.fromPlayerId && myId !== event.toPlayerId) {
            return;
        }

        const isMyTurn = event.nextActorPlayerId === myId;
        this.activeRequestId = event.requestId;
        const opponentId = myId === event.fromPlayerId ? event.toPlayerId : event.fromPlayerId;
        const opponentName = this.gameScene.players.get(opponentId)?.playerName ?? event.fromUsername ?? 'Opponent';
        const myOwnedTiles = this.getOwnedTileCount(myId);
        const opponentOwnedTiles = this.getOwnedTileCount(opponentId);
        const maxAllowedRaise = Math.min(myOwnedTiles, opponentOwnedTiles);

        if (!isMyTurn) {
            this.gameScene.closeWagerModal();
            this.gameScene.showWagerToast(`Wager is now ${event.currentBetTiles}. Waiting for ${opponentName} to act.`);
            return;
        }

        const raiseInput = document.createElement('input');
        raiseInput.className = 'wager-bet-input';
        raiseInput.type = 'number';
        raiseInput.min = String(event.currentBetTiles + 1);
        raiseInput.step = '1';
        raiseInput.value = String(event.currentBetTiles + 5);
        raiseInput.placeholder = 'Raise wager';

        const helperText = document.createElement('p');
        helperText.className = 'wager-helper-text';
        helperText.textContent = `Current wager: ${event.currentBetTiles}. Raise range: ${event.currentBetTiles + 1}-${maxAllowedRaise}.`;

        const validateRaise = () => {
            const raisedBetTiles = Math.floor(Number(raiseInput.value));
            if (!Number.isInteger(raisedBetTiles)) {
                helperText.textContent = 'Raise must be a whole number.';
                return false;
            }
            if (raisedBetTiles <= event.currentBetTiles) {
                helperText.textContent = `Raise must be greater than ${event.currentBetTiles}.`;
                return false;
            }
            if (raisedBetTiles > maxAllowedRaise) {
                helperText.textContent = `Raise cannot exceed ${maxAllowedRaise} based on both players' tiles.`;
                return false;
            }
            helperText.textContent = `Current wager: ${event.currentBetTiles}. Raise range: ${event.currentBetTiles + 1}-${maxAllowedRaise}.`;
            return true;
        };

        const raiseButton = document.createElement('button');
        raiseButton.type = 'button';
        raiseButton.className = 'wager-button wager-button-secondary';
        raiseButton.textContent = 'Raise';
        raiseButton.onclick = () => {
            if (!validateRaise()) {
                return;
            }

            const raisedBetTiles = Math.floor(Number(raiseInput.value));

            this.gameScene.socket?.emit('sendWagerAction', {
                requestId: event.requestId,
                action: 'raise',
                betTiles: raisedBetTiles,
            });
            raiseButton.disabled = true;
        };

        const modal = this.gameScene.openWagerModal({
            pill: 'Wager Turn',
            title: `Your move vs ${opponentName}`,
            body: `Current wager: ${event.currentBetTiles} each.`,
            customContent: [raiseInput, helperText, raiseButton],
            primaryLabel: 'Call',
            secondaryLabel: 'Decline',
            onPrimary: () => {
                this.gameScene.socket?.emit('sendWagerAction', {
                    requestId: event.requestId,
                    action: 'call',
                });
                modal.primaryButton.disabled = true;
                raiseButton.disabled = true;
                modal.secondaryButton.disabled = true;
            },
            onSecondary: () => {
                this.gameScene.socket?.emit('sendWagerAction', {
                    requestId: event.requestId,
                    action: 'decline',
                });
                this.gameScene.closeWagerModal();
            },
        });

        const syncRaiseButton = () => {
            raiseButton.disabled = !validateRaise();
        };
        raiseInput.addEventListener('input', syncRaiseButton);
        syncRaiseButton();
    }

    handleWagerResult(result: WagerResultEvent) {
        if (!this.gameScene.currentPlayer) return;

        const isRequester = result.fromPlayerId === this.gameScene.currentPlayer.playerId;
        const otherPlayerId = isRequester ? result.toPlayerId : result.fromPlayerId;
        const otherPlayer = this.gameScene.players.get(otherPlayerId);
        const otherName = otherPlayer?.playerName ?? 'Player';

        if (result.accepted) {
            this.activeRequestId = null;
            this.gameScene.closeWagerModal();
            this.gameScene.showWagerToast(`${otherName} called. ${result.minigameName} starts now.`);
            return;
        }

        if (result.reason) {
            const isDeclineReason = /declined/i.test(result.reason);
            if (!isDeclineReason && this.gameScene.activeWagerModal) {
                this.setInlineWarning(result.reason);
                const modalButtons = this.gameScene.activeWagerModal.querySelectorAll('.wager-button') as NodeListOf<HTMLButtonElement>;
                modalButtons.forEach((button) => {
                    if (button.textContent?.toLowerCase().includes('raise') || button.textContent?.toLowerCase().includes('call') || button.textContent?.toLowerCase().includes('send request')) {
                        button.disabled = false;
                    }
                });
                return;
            }

            this.activeRequestId = null;
            this.gameScene.closeWagerModal();
            this.gameScene.showWagerToast(result.reason);
            return;
        }

        this.activeRequestId = null;
        this.gameScene.closeWagerModal();

        if (isRequester) {
            this.gameScene.showWagerToast(`${otherName} declined your wager request.`);
        } else {
            this.gameScene.showWagerToast('You declined the wager request.');
        }
    }
}
