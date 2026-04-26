import * as Phaser from "phaser";
import PlayerSprite from "./player/PlayerSprite";
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events'
import type { ScenePosition } from "./types";
import type { GameInitData } from "../../server/server";
import { preloadAvatarTextures } from "./utils/avatarLoader";
import type {
    MinigameCompletedEvent,
    MinigameStartedEvent,
    WagerRequestEvent,
    WagerResultEvent,
} from '../../server/events'
import { pickRandomMinigame, type MinigameDefinition } from "./minigames/Minigame";
import { getMinigameUiConfig } from "./minigames/pillowSmash/pillowSmashConfig";
import './minigames/wagerModal.css'
import { GameMap } from "../tilemap/GameMap";

const pillowSmashImage = new URL('./minigames/pillowSmash/pillow.jpg', import.meta.url).href;
const pillowSmashImageFallback = '/src/game/minigames/pillowSmash/pillow.jpg';
import type { MinigameScene } from "./minigames/MinigameScene";

export class GameScene extends Phaser.Scene {
    players: Map<string, PlayerSprite>;
    currentPlayer: PlayerSprite | null;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    isReady: boolean;
    wasd: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    } | null;
    playerGroup: Phaser.Physics.Arcade.Group | null;

    //Click to move
    targetPosition: ScenePosition | null;
    moveSpeed: number;
    clickIndicator: Phaser.GameObjects.Graphics | null;
    isMobile: boolean;
    activeWagerModal: HTMLDivElement | null;
    activeWagerToast: HTMLDivElement | null;
    activeToastTimeout: number | null;
    activeMinigameModal: HTMLDivElement | null;
    activeMinigameTimer: number | null;
    activeMinigameDurationTimer: number | null;
    currentMinigameScore: number;
    currentMinigameRequestId: string | null;
    hasSubmittedMinigameScore: boolean;
    gameMap: GameMap;

    
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.currentPlayer = null;
        this.cursors = null;
        this.socket = null;
        this.isReady = false;

        this.wasd = null;
        this.playerGroup = null;
        
        // Click-to-move properties
        this.targetPosition = null;
        this.moveSpeed = 200;
        this.clickIndicator = null;
        this.isMobile = window.innerWidth <= 768;
        
        this.activeWagerModal = null;
        this.activeWagerToast = null;
        this.activeToastTimeout = null;
        this.activeMinigameModal = null;
        this.activeMinigameTimer = null;
        this.activeMinigameDurationTimer = null;
        this.currentMinigameScore = 0;
        this.currentMinigameRequestId = null;
        this.hasSubmittedMinigameScore = false;

        this.gameMap = new GameMap(this);
    }

    initialize(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;
        this.setupSocketListeners();
    }

    preload() {
        // Return the promise so Phaser waits for avatars to load before create()
        return preloadAvatarTextures(this);
    }

    create() {        
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
        this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
                
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D') as {
            W: Phaser.Input.Keyboard.Key;
            A: Phaser.Input.Keyboard.Key;
            S: Phaser.Input.Keyboard.Key;
            D: Phaser.Input.Keyboard.Key;
        };
        
        // Set up click-to-move for mobile and desktop
        this.input.on('pointerdown', this.handlePointerDown, this);
        
        // Create click indicator
        this.clickIndicator = this.add.graphics();
        this.clickIndicator.setDepth(1000);
        this.clickIndicator.setVisible(false);
        
        // Mark scene as ready
        this.isReady = true;
        console.log('GameScene is ready');

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.closeWagerModal();
            this.clearWagerToast();
            this.closeMinigameModal();
        });

        this.scale.on('resize', () => {
            this.fitWorldToViewport();
        });
    }

    setupSocketListeners() {
        this.socket!.on('gameInit', (data: GameInitData) => {
            console.log('Game initialized:', data);
            
            // Create Phaser tilemap from server data
            this.gameMap.createTilemapFromData(data.tilemap);
            // Ensure world and camera bounds match the tilemap so the camera can follow correctly
            if (this.gameMap.tilemap) {
                const worldWidth = this.gameMap.tilemap.widthInPixels;
                const worldHeight = this.gameMap.tilemap.heightInPixels;
                this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
                this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
                this.fitWorldToViewport();
            }
            
            // Create current player with custom data
            this.currentPlayer = new PlayerSprite(this, data.player.x, data.player.y, data.playerId, true, data.playerData);
            this.players.set(data.playerId, this.currentPlayer);
            
            // Create player group for collisions
            this.playerGroup = this.physics.add.group();
            this.playerGroup.add(this.currentPlayer);
            
            // Set camera to follow current player
            this.cameras.main.startFollow(this.currentPlayer, true, 0.05, 0.05);
            this.cameras.main.setZoom(1);
            
            // Create other players
            data.players.forEach(otherPlayerData => {
                if (otherPlayerData.id !== data.playerId) {
                    const player = new PlayerSprite(this, otherPlayerData.x, otherPlayerData.y, otherPlayerData.id, false, otherPlayerData);
                    this.players.set(otherPlayerData.id, player);
                    this.playerGroup!.add(player);
                }
            });
            
            // Set up collisions between all players
            this.physics.add.collider(this.playerGroup, this.playerGroup);
            
            console.log('All game objects created, showing game UI');
            this.socket!.emit('gameSceneReady');
        });

        this.socket!.on('playerJoined', (playerJson, playerData) => {
            console.log('Player joined:', playerJson);
            const playerSprite = new PlayerSprite(this, playerJson.x, playerJson.y, playerJson.id, false, playerData);
            this.players.set(playerJson.id, playerSprite);
            if (this.playerGroup) {
                this.playerGroup.add(playerSprite);
            }
        });

        this.socket!.on('playerMoved', (data) => {
            const player = this.players.get(data.playerId);
            if (player) {
                player.updatePosition(data.x, data.y);
            }
        });

        this.socket!.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
            const player = this.players.get(playerId);
            if (player) {
                player.destroy();
                this.players.delete(playerId);
            }
        });
        
        // Handle single tile update from server
        this.socket!.on('tileUpdated', (tileData) => {
            this.gameMap.putTileAt(tileData.index, tileData.x, tileData.y);
        });
        
        // Handle batch tile updates from server
        this.socket!.on('tilesUpdated', (tilesData) => {
            tilesData.forEach(tile => {
                this.gameMap.putTileAt(tile.index, tile.x, tile.y);
            });
        });
        
        // Handle tiles claimed from server
        this.socket!.on('tilesClaimed', (tilesData) => {
            tilesData.forEach(tile => {
                this.gameMap.putTileAt(tile.index, tile.x, tile.y);
                // Set properties on the tile
                const tileObject = this.gameMap.getTileAt(tile.x, tile.y, false);
                if (tileObject && tile.properties) {
                    tileObject.properties = tile.properties;
                }
            });
        });
        
        // Handle tiles unclaimed from server
        this.socket!.on('tilesUnclaimed', (tilesData) => {
            tilesData.forEach(tile => {
                this.gameMap.putTileAt(tile.index, tile.x, tile.y);
                // Clear properties on the tile
                const tileObject = this.gameMap.getTileAt(tile.x, tile.y, false);
                if (tileObject) {
                    tileObject.properties = tile.properties || { owner: null, faction: null };
                }
            });
        });

        this.socket!.on('wagerRequestReceived', (request) => {
            this.openIncomingWagerModal(request);
        });

        this.socket!.on('wagerRequestResult', (result) => {
            this.handleWagerResult(result);
        });

        this.socket!.on('minigameStarted', (event) => {
            this.openMinigameModal(event);
        });

        this.socket!.on('minigameCompleted', (event) => {
            this.handleMinigameCompleted(event);
        });
    }

    update() {
        if (!this.currentPlayer || !this.isReady) return;
        
        // Handle player movement
        let velocityX = 0;
        let velocityY = 0;
        const speed = this.moveSpeed;
        
        // Keyboard movement (takes priority over click-to-move)
        let keyboardMovement = false;
        if (this.cursors!.left.isDown || this.wasd!.A.isDown) {
            velocityX = -speed;
            keyboardMovement = true;
        }
        if (this.cursors!.right.isDown || this.wasd!.D.isDown) {
            velocityX = speed;
            keyboardMovement = true;
        }
        if (this.cursors!.up.isDown || this.wasd!.W.isDown) {
            velocityY = -speed;
            keyboardMovement = true;
        }
        if (this.cursors!.down.isDown || this.wasd!.S.isDown) {
            velocityY = speed;
            keyboardMovement = true;
        }
        
        // If using keyboard, cancel click-to-move
        if (keyboardMovement && this.targetPosition) {
            this.targetPosition = null;
            this.hideClickIndicator();
        }
        
        // Click-to-move (only if no keyboard input)
        if (!keyboardMovement && this.targetPosition) {
            const distance = Phaser.Math.Distance.Between(
                this.currentPlayer.x, this.currentPlayer.y,
                this.targetPosition.x, this.targetPosition.y
            );
            
            if (distance > 5) {
                const angle = Phaser.Math.Angle.Between(
                    this.currentPlayer.x, this.currentPlayer.y,
                    this.targetPosition.x, this.targetPosition.y
                );
                
                velocityX = Math.cos(angle) * speed;
                velocityY = Math.sin(angle) * speed;
            } else {
                this.targetPosition = null;
                this.hideClickIndicator();
            }
        }
        
        //it's a Body i promise
        //@ts-ignore
        this.currentPlayer.body.setVelocity(velocityX, velocityY);
        
        // Send position update to server if player moved
        if (velocityX !== 0 || velocityY !== 0) {
            if (this.socket) {
                this.socket.emit('playerMove', {
                    x: this.currentPlayer.x,
                    y: this.currentPlayer.y
                });
            }
        }
    }

    handlePointerDown(pointer: Phaser.Input.Pointer) {
      if (!this.currentPlayer) return;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

                const clickedPlayer = this.checkPlayerClick(worldPoint.x, worldPoint.y);
                if (clickedPlayer && clickedPlayer.playerId !== this.currentPlayer.playerId) {
                        this.targetPosition = null;
                        this.hideClickIndicator();
                        this.openOutgoingWagerModal(clickedPlayer);
                        return;
                }
        
        this.targetPosition = { x: worldPoint.x, y: worldPoint.y };
        this.showClickIndicator(worldPoint.x, worldPoint.y);
    }

    checkPlayerClick(worldX: number, worldY: number) {
        // Check if click position is near any player
        for (const player of this.players.values()) {
            const distance = Phaser.Math.Distance.Between(worldX, worldY, player.x, player.y);
            if (distance <= 40) { // 40 pixel radius for clicking on players
                return player;
            }
        }
        return null;
    }

    showClickIndicator(_x: number, _y: number) {
        //TODO: fix ts
        // if (!this.clickIndicator) return;
        // this.clickIndicator.clear();
        // this.clickIndicator.lineStyle(2, 0xf39c12);
        // this.clickIndicator.strokeCircle(x, y, 10);
        // this.clickIndicator.setVisible(true);
        
        // const indicator = document.getElementById('click-to-move-indicator');
        // if (indicator) {
        //     indicator.style.left = (x - 10) + 'px';
        //     indicator.style.top = (y - 10) + 'px';
        //     indicator.style.display = 'block';
            
        //     setTimeout(() => {
        //         indicator.style.display = 'none';
        //     }, 1000);
        // }
    }

    hideClickIndicator() {
        if (this.clickIndicator) {
            this.clickIndicator.setVisible(false);
        };
        const indicator = document.getElementById('click-to-move-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    openOutgoingWagerModal(targetPlayer: PlayerSprite) {
        const minigame = pickRandomMinigame();

        const bodyCopy = `${targetPlayer.playerName}, wanna settle this with ${minigame.name}?`;

        const betInput = document.createElement('input');
        betInput.className = 'wager-bet-input';
        betInput.type = 'number';
        betInput.min = '5';
        betInput.step = '1';
        betInput.value = '10';
        betInput.placeholder = 'Bet tiles';

        const helperText = document.createElement('p');
        helperText.className = 'wager-helper-text';
        helperText.textContent = 'Minimum bet is 5 tiles.';

        this.openWagerModal({
            pill: 'Sleepover Challenge',
            title: `Challenge ${targetPlayer.playerName}?`,
            body: bodyCopy,
            customContent: [betInput, helperText],
            primaryLabel: 'Send Request',
            secondaryLabel: 'Maybe Later',
            onPrimary: () => {
                const betTiles = Math.floor(Number(betInput.value));
                if (!Number.isInteger(betTiles) || betTiles < 5) {
                    helperText.textContent = 'Minimum bet is 5 tiles.';
                    return;
                }

                this.socket?.emit('sendWagerRequest', {
                    toPlayerId: targetPlayer.playerId,
                    minigameId: minigame.id,
                    minigameName: minigame.name,
                    betTiles,
                });
                this.showWagerToast(`Wager request sent to ${targetPlayer.playerName}.`);
                this.closeWagerModal();
            },
            onSecondary: () => {
                this.closeWagerModal();
            },
        });
    }

    openIncomingWagerModal(request: WagerRequestEvent) {
        const bodyCopy = `${request.fromUsername} challenged you to ${request.minigameName}.`;

        const betInput = document.createElement('input');
        betInput.className = 'wager-bet-input';
        betInput.type = 'number';
        betInput.min = '5';
        betInput.step = '1';
        betInput.value = '10';
        betInput.placeholder = 'Your hidden bet';

        const helperText = document.createElement('p');
        helperText.className = 'wager-helper-text';
        helperText.textContent = 'Minimum bet is 5 tiles.';

        this.openWagerModal({
            pill: 'Incoming Wager',
            title: 'Accept this challenge?',
            body: bodyCopy,
            customContent: [betInput, helperText],
            primaryLabel: 'Yes, Let\'s Play',
            secondaryLabel: 'No Thanks',
            onPrimary: () => {
                const betTiles = Math.floor(Number(betInput.value));
                if (!Number.isInteger(betTiles) || betTiles < 5) {
                    helperText.textContent = 'Minimum bet is 5 tiles.';
                    return;
                }

                this.socket?.emit('sendWagerResponse', {
                    requestId: request.requestId,
                    fromPlayerId: request.fromPlayerId,
                    accepted: true,
                    betTiles,
                });
                this.closeWagerModal();
            },
            onSecondary: () => {
                this.socket?.emit('sendWagerResponse', {
                    requestId: request.requestId,
                    fromPlayerId: request.fromPlayerId,
                    accepted: false,
                });
                this.closeWagerModal();
            },
        });
    }

    handleWagerResult(result: WagerResultEvent) {
        if (!this.currentPlayer) return;

        const isRequester = result.fromPlayerId === this.currentPlayer.playerId;
        const otherPlayerId = isRequester ? result.toPlayerId : result.fromPlayerId;
        const otherPlayer = this.players.get(otherPlayerId);
        const otherName = otherPlayer?.playerName ?? 'Player';

        if (result.accepted) {
            this.showWagerToast(`${otherName} accepted. ${result.minigameName} starts now.`);
            return;
        }

        if (result.reason) {
            this.showWagerToast(result.reason);
            return;
        }

        if (isRequester) {
            this.showWagerToast(`${otherName} declined your wager request.`);
        } else {
            this.showWagerToast('You declined the wager request.');
        }
    }

    openWagerModal(options: {
        pill: string;
        title: string;
        body: string;
        customContent?: HTMLElement[];
        primaryLabel: string;
        secondaryLabel: string;
        onPrimary: () => void;
        onSecondary: () => void;
    }) {
        this.closeWagerModal();

        const overlay = document.createElement('div');
        overlay.className = 'wager-modal-overlay';

        const card = document.createElement('section');
        card.className = 'wager-modal-card';

        const pill = document.createElement('span');
        pill.className = 'wager-modal-pill';
        pill.textContent = options.pill;

        const title = document.createElement('h2');
        title.className = 'wager-modal-title';
        title.textContent = options.title;

        const copy = document.createElement('p');
        copy.className = 'wager-modal-copy';
        copy.textContent = options.body;
        copy.style.whiteSpace = 'pre-line';

        const customContent = document.createElement('div');
        customContent.className = 'wager-modal-custom';
        if (options.customContent) {
            options.customContent.forEach((element) => customContent.appendChild(element));
        }

        const actions = document.createElement('div');
        actions.className = 'wager-modal-actions';

        const secondaryButton = document.createElement('button');
        secondaryButton.type = 'button';
        secondaryButton.className = 'wager-button wager-button-secondary';
        secondaryButton.textContent = options.secondaryLabel;
        secondaryButton.onclick = options.onSecondary;

        const primaryButton = document.createElement('button');
        primaryButton.type = 'button';
        primaryButton.className = 'wager-button wager-button-primary';
        primaryButton.textContent = options.primaryLabel;
        primaryButton.onclick = options.onPrimary;

        actions.appendChild(secondaryButton);
        actions.appendChild(primaryButton);

        card.appendChild(pill);
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(customContent);
        card.appendChild(actions);
        overlay.appendChild(card);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.closeWagerModal();
            }
        });

        document.body.appendChild(overlay);
        this.activeWagerModal = overlay;
    }

    closeWagerModal() {
        if (!this.activeWagerModal) return;
        this.activeWagerModal.remove();
        this.activeWagerModal = null;
    }

    showWagerToast(message: string) {
        this.clearWagerToast();

        const toast = document.createElement('div');
        toast.className = 'wager-toast';
        toast.textContent = message;

        document.body.appendChild(toast);
        this.activeWagerToast = toast;
        this.activeToastTimeout = window.setTimeout(() => {
            this.clearWagerToast();
        }, 2800);
    }

    clearWagerToast() {
        if (this.activeToastTimeout !== null) {
            window.clearTimeout(this.activeToastTimeout);
            this.activeToastTimeout = null;
        }

        if (!this.activeWagerToast) return;
        this.activeWagerToast.remove();
        this.activeWagerToast = null;
    }

    openMinigameModal(event: MinigameStartedEvent) {
        if (!this.currentPlayer) return;
        if (!event.playerIds.includes(this.currentPlayer.playerId)) return;

        this.closeMinigameModal();

        const opponentId = event.playerIds.find((id) => id !== this.currentPlayer!.playerId) ?? '';
        const opponentName = this.players.get(opponentId)?.playerName ?? 'Opponent';

        this.currentMinigameRequestId = event.requestId;
        this.currentMinigameScore = 0;
        this.hasSubmittedMinigameScore = false;
        const minigameUi = getMinigameUiConfig(event.minigameId);

        const overlay = document.createElement('div');
        overlay.className = 'wager-modal-overlay minigame-overlay-fullscreen';
        overlay.style.padding = '0';

        const card = document.createElement('section');
        card.className = 'wager-modal-card minigame-card minigame-fullscreen-card';
        // Force large full-screen gameplay card even if CSS is stale/overridden.
        card.style.width = '96vw';
        card.style.maxWidth = '1400px';
        card.style.minHeight = '92vh';
        card.style.padding = 'clamp(24px, 3.2vw, 44px)';
        card.style.borderRadius = '28px';

        if (window.innerWidth <= 640) {
            card.style.width = '100vw';
            card.style.maxWidth = '100vw';
            card.style.minHeight = '100vh';
            card.style.borderRadius = '0';
            card.style.padding = '16px';
        }

        const pill = document.createElement('span');
        pill.className = 'wager-modal-pill';
        pill.textContent = minigameUi.pillText;

        const title = document.createElement('h2');
        title.className = 'wager-modal-title';
        title.textContent = `${event.minigameName} vs ${opponentName}`;

        const copy = document.createElement('p');
        copy.className = 'wager-modal-copy minigame-subtitle';
        copy.textContent = minigameUi.instructions;

        const hud = document.createElement('div');
        hud.className = 'minigame-hud';

        const timerText = document.createElement('div');
        timerText.className = 'minigame-hud-item minigame-timer';
        timerText.textContent = 'Time left: 5.0s';

        const scoreText = document.createElement('div');
        scoreText.className = 'minigame-hud-item minigame-score';
        scoreText.textContent = 'Your score: 0';

        hud.appendChild(timerText);
        hud.appendChild(scoreText);

        const progressTrack = document.createElement('div');
        progressTrack.className = 'minigame-progress-track';
        const progressFill = document.createElement('div');
        progressFill.className = 'minigame-progress-fill';
        progressTrack.appendChild(progressFill);

        const smashTarget = document.createElement('img');
        smashTarget.className = 'minigame-smash-image';
        smashTarget.alt = 'Pillow Smash target';
        smashTarget.draggable = false;
        smashTarget.loading = 'eager';
        smashTarget.decoding = 'sync';
        smashTarget.src = pillowSmashImageFallback;
        smashTarget.onerror = () => {
            // Fallback to module-resolved URL if direct source path fails.
            smashTarget.onerror = null;
            smashTarget.src = pillowSmashImage;
        };
        smashTarget.onclick = () => {
            if (this.hasSubmittedMinigameScore) return;
            this.currentMinigameScore += 1;
            scoreText.textContent = `Your score: ${this.currentMinigameScore}`;
            smashTarget.classList.remove('smash-hit');
            // Restart short animation on rapid taps.
            void smashTarget.offsetWidth;
            smashTarget.classList.add('smash-hit');
        };

        const arena = document.createElement('div');
        arena.className = 'minigame-arena';
        arena.appendChild(smashTarget);

        card.appendChild(pill);
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(hud);
        card.appendChild(progressTrack);
        card.appendChild(arena);

        // Safety guard: if any stale button node is injected, remove it so
        // Pillow Smash only uses the pillow picture as the clickable target.
        card.querySelectorAll('button').forEach((buttonNode) => {
            buttonNode.remove();
        });

        overlay.appendChild(card);

        document.body.appendChild(overlay);
        this.activeMinigameModal = overlay;

        const startedAt = Date.now();
        this.activeMinigameTimer = window.setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, 5000 - elapsedMs);
            timerText.textContent = `Time left: ${(remainingMs / 1000).toFixed(1)}s`;
            const elapsedRatio = Math.min(1, elapsedMs / 5000);
            progressFill.style.width = `${(1 - elapsedRatio) * 100}%`;
        }, 100);

        this.activeMinigameDurationTimer = window.setTimeout(() => {
            this.submitMinigameScore();
            smashTarget.classList.add('smash-disabled');
            smashTarget.style.pointerEvents = 'none';
            smashTarget.title = minigameUi.waitingLabel;
            timerText.textContent = 'Time left: 0.0s';
            progressFill.style.width = '0%';
        }, 5000);
    }

    launchMinigameScene<T extends MinigameScene>(minigameScene: MinigameScene, minigameDef: MinigameDefinition): T {
        // Pause this scene so the game world stops updating
        this.scene.pause();

        // Add and start the overlay scene instance
        const sceneKey = minigameDef.id;
        const child = this.scene.add(sceneKey, minigameScene) as T;

        // Bring it above everything
        this.scene.bringToTop(sceneKey);

        // When the overlay shuts down, resume this scene and remove the overlay
        if (child && child.events) {
            child.events.once('shutdown', () => {
                this.scene.resume();
                try {
                    this.scene.remove(sceneKey);
                } catch (e) {
                    // ignore
                }
            });
        }

        return child;
    }

    submitMinigameScore() {
        if (this.hasSubmittedMinigameScore) return;
        if (!this.currentMinigameRequestId) return;

        this.hasSubmittedMinigameScore = true;
        this.socket?.emit('submitMinigameScore', {
            requestId: this.currentMinigameRequestId,
            score: this.currentMinigameScore,
        });
    }

    handleMinigameCompleted(event: MinigameCompletedEvent) {
        if (!this.currentPlayer) return;
        if (this.currentMinigameRequestId !== event.requestId) return;

        const winnerId = event.winnerPlayerId;
        const myId = this.currentPlayer.playerId;
        const myScore = event.scores.find((entry) => entry.playerId === myId)?.score ?? 0;
        const opponentScore = event.scores.find((entry) => entry.playerId !== myId)?.score ?? 0;

        this.closeMinigameModal();

        if (!winnerId) {
            this.showWagerToast(`Tie game (${myScore}-${opponentScore}). No pillow-fight winner this round.`);
            return;
        }

        if (winnerId === myId) {
            this.showWagerToast(`You won ${event.minigameName} (${myScore}-${opponentScore}) and won the pillow fight!`);
            return;
        }

        const winnerName = this.players.get(winnerId)?.playerName ?? 'Opponent';
        this.showWagerToast(`${winnerName} won ${event.minigameName} (${opponentScore}-${myScore}) and won the pillow fight.`);
    }

    closeMinigameModal() {
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

        this.currentMinigameScore = 0;
        this.currentMinigameRequestId = null;
        this.hasSubmittedMinigameScore = false;
    }

    playSpatialAudio(soundKey: string, position: ScenePosition) {
        if (!this.currentPlayer) return;
        
        // Calculate distance between player and sound source
        const distance = Phaser.Math.Distance.Between(
            this.currentPlayer.x, this.currentPlayer.y,
            position.x, position.y
        );
        
        // Maximum hearing distance (beyond this, sound volume is 0)
        const MAX_DISTANCE = 400;
        
        // Calculate volume based on distance (1.0 at source, 0.0 at max distance)
        let volume = Math.max(0, 1 - (distance / MAX_DISTANCE));
        
        // Apply volume curve for more realistic falloff
        volume = Math.pow(volume, 2); // Exponential falloff
        
        // Only play if volume is above threshold
        if (volume > 0.05) {
            // Calculate pan based on horizontal position relative to player
            const deltaX = position.x - this.currentPlayer.x;
            const pan = Math.max(-1, Math.min(1, deltaX / 200)); // Pan range: -1 to 1
            
            // Play the sound with spatial properties
            const sound = this.sound.add(soundKey, {
                volume: volume * 0.7, // Scale down overall volume
                pan: pan
            });
            
            sound.play();
            
            // Clean up the sound when it finishes
            sound.once('complete', () => {
                sound.destroy();
            });
            
            console.log(`Playing ${soundKey} at distance ${Math.round(distance)} with volume ${volume.toFixed(2)} and pan ${pan.toFixed(2)}`);
        }
    }

    fitWorldToViewport() {
        if (!this.gameMap.tilemap) return;

        const worldWidth = this.gameMap.tilemap.widthInPixels;
        const worldHeight = this.gameMap.tilemap.heightInPixels;
        const viewportWidth = this.scale.width;
        const viewportHeight = this.scale.height;

        if (worldWidth <= 0 || worldHeight <= 0) return;

        // Prevent seeing outside map bounds on extra-wide/tall screens.
        const minZoomToFill = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight);
        this.cameras.main.setZoom(Math.max(1, minZoomToFill));
    }
  }