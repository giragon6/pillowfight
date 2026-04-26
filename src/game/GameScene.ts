import * as Phaser from "phaser";
import PlayerSprite from "./player/PlayerSprite";
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events'
import type { ScenePosition } from "./types";
import type { GameInitData } from "../../server/server";
import { preloadAvatarTextures } from "./utils/avatarLoader";
import { getAvatarAssets } from "./utils/avatarLoader";
import type {
    WagerRequestEvent,
    WagerResultEvent,
} from '../../server/events'
import { pickRandomMinigame } from "./minigames/Minigame";
import './minigames/wagerModal.css'
import { GameMap } from "../tilemap/GameMap";
import FACTION_COLORS from "../../shared/factionColors";
import MinigameManager from "./minigames/MinigameManager";

const pillowSmashImage = new URL('./minigames/pillowSmash/pillow.jpg', import.meta.url).href;
const pillowSmashImageFallback = '/src/game/minigames/pillowSmash/pillow.jpg';
const avatarUrlByKey = new Map(getAvatarAssets().map(({ key, url }) => [key, url]));
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

    activeLeaderboardButton: HTMLButtonElement | null;
    activeLeaderboardModal: HTMLDivElement | null;
    gameMap: GameMap;
    minigameManager: MinigameManager | null = null;
    
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
        this.activeLeaderboardButton = null;
        this.activeLeaderboardModal = null;

        this.gameMap = new GameMap(this);
    }

    initialize(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;
        this.setupSocketListeners();
        this.minigameManager = new MinigameManager(this);
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
            this.minigameManager!.closeMinigameModal();
            this.closeLeaderboardModal();
            this.removeLeaderboardButton();
        });

        this.createLeaderboardButton();

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

    createLeaderboardButton() {
        this.removeLeaderboardButton();

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'leaderboard-fab';
        button.setAttribute('aria-label', 'Open faction leaderboard');
        button.innerHTML = '<span class="leaderboard-fab-icon" aria-hidden="true"></span>';
        button.onclick = () => this.openLeaderboardModal();

        document.body.appendChild(button);
        this.activeLeaderboardButton = button;
    }

    removeLeaderboardButton() {
        if (!this.activeLeaderboardButton) return;
        this.activeLeaderboardButton.remove();
        this.activeLeaderboardButton = null;
    }

    getFactionTileCounts() {
        const counts = {
            Lavender: 0,
            Yellow: 0,
            Blue: 0,
            Pink: 0,
        };

        const layerData = this.gameMap.tilemapLayer?.layer?.data;
        if (!layerData) return counts;

        layerData.forEach((row) => {
            row.forEach((tile) => {
                if (tile.index === 1) counts.Lavender += 1;
                if (tile.index === 2) counts.Yellow += 1;
                if (tile.index === 3) counts.Blue += 1;
                if (tile.index === 4) counts.Pink += 1;
            });
        });

        return counts;
    }

    getCharacterTileCounts() {
        const counts = new Map<string, number>();
        const layerData = this.gameMap.tilemapLayer?.layer?.data;
        if (!layerData) return counts;

        layerData.forEach((row) => {
            row.forEach((tile) => {
                if (tile.index <= 0) return;

                const ownerId = tile.properties?.owner as string | undefined;
                if (!ownerId) return;

                const owner = this.players.get(ownerId);
                const avatarKey = owner?.avatarKey ?? 'Unknown';
                counts.set(avatarKey, (counts.get(avatarKey) ?? 0) + 1);
            });
        });

        return counts;
    }

    persistLeaderboardSnapshot() {
        const counts = this.getFactionTileCounts();
        const claimedTiles = counts.Lavender + counts.Yellow + counts.Blue + counts.Pink;
        const factions = Object.entries(counts)
            .map(([faction, tiles]) => ({
                faction,
                tiles,
                percentage: claimedTiles === 0 ? 0 : Number(((tiles / claimedTiles) * 100).toFixed(2)),
            }))
            .sort((a, b) => b.tiles - a.tiles);

        const characters = Array.from(this.getCharacterTileCounts().entries())
            .map(([avatarKey, tiles]) => ({
                avatarKey,
                tiles,
                percentage: claimedTiles === 0 ? 0 : Number(((tiles / claimedTiles) * 100).toFixed(2)),
            }))
            .sort((a, b) => b.tiles - a.tiles);

        const snapshot = {
            claimedTiles,
            totalTiles: this.gameMap.tilemap ? this.gameMap.tilemap.width * this.gameMap.tilemap.height : 0,
            factions,
            characters,
            updatedAt: Date.now(),
        };

        try {
            window.localStorage.setItem('leaderboardSnapshot', JSON.stringify(snapshot));
        } catch (_error) {
            // Ignore localStorage failures and let the full page use API only.
        }
    }

    openLeaderboardModal() {
        this.closeLeaderboardModal();

        const counts = this.getFactionTileCounts();
        const entries = Object.entries(counts)
            .map(([name, tileCount]) => ({ name, tileCount }))
            .sort((a, b) => b.tileCount - a.tileCount);
        const totalTiles = entries.reduce((sum, entry) => sum + entry.tileCount, 0);
        const characterEntries = Array.from(this.getCharacterTileCounts().entries())
            .map(([avatarKey, tileCount]) => ({ avatarKey, tileCount }))
            .sort((a, b) => b.tileCount - a.tileCount);

        const overlay = document.createElement('div');
        overlay.className = 'wager-modal-overlay leaderboard-overlay';

        const card = document.createElement('section');
        card.className = 'wager-modal-card leaderboard-card';

        const topRow = document.createElement('div');
        topRow.className = 'leaderboard-top-row';

        const pill = document.createElement('span');
        pill.className = 'wager-modal-pill';
        pill.textContent = 'Territory Leaderboard';

        const openInTabLink = document.createElement('a');
        openInTabLink.className = 'leaderboard-open-tab-link';
        openInTabLink.href = '/leaderboard';
        openInTabLink.target = '_blank';
        openInTabLink.rel = 'noopener noreferrer';
        openInTabLink.textContent = 'Open full page';
        openInTabLink.addEventListener('click', () => {
            this.persistLeaderboardSnapshot();
        });

        topRow.appendChild(pill);
        topRow.appendChild(openInTabLink);

        const title = document.createElement('h2');
        title.className = 'wager-modal-title';
        title.textContent = 'Faction Leading Teams';

        const leaderLine = document.createElement('p');
        leaderLine.className = 'wager-modal-copy leaderboard-leader';
        if (totalTiles === 0) {
            leaderLine.textContent = 'No faction territory claimed yet.';
        } else {
            const leader = entries[0];
            const leaderPercent = ((leader.tileCount / totalTiles) * 100).toFixed(1);
            leaderLine.textContent = `${leader.name} is leading with ${leader.tileCount} tiles (${leaderPercent}%).`;
        }

        const pieChart = document.createElement('div');
        pieChart.className = 'leaderboard-pie-chart';
        if (totalTiles === 0) {
            pieChart.style.background = '#ece6ef';
        } else {
            let runningPercent = 0;
            const segments = entries
                .filter((entry) => entry.tileCount > 0)
                .map((entry) => {
                    const start = runningPercent;
                    const span = (entry.tileCount / totalTiles) * 100;
                    runningPercent += span;
                    const color = `#${FACTION_COLORS[entry.name as keyof typeof FACTION_COLORS]
                        .toString(16)
                        .padStart(6, '0')}`;
                    return `${color} ${start.toFixed(2)}% ${runningPercent.toFixed(2)}%`;
                });
            pieChart.style.background = `conic-gradient(${segments.join(', ')})`;
        }

        const legend = document.createElement('ul');
        legend.className = 'leaderboard-legend';

        entries.forEach((entry) => {
            const item = document.createElement('li');
            item.className = 'leaderboard-legend-item';

            const swatch = document.createElement('span');
            swatch.className = 'leaderboard-swatch';
            swatch.style.background = `#${FACTION_COLORS[entry.name as keyof typeof FACTION_COLORS]
                .toString(16)
                .padStart(6, '0')}`;

            const percent = totalTiles === 0 ? 0 : (entry.tileCount / totalTiles) * 100;
            const text = document.createElement('span');
            text.className = 'leaderboard-legend-text';
            text.textContent = `${entry.name}: ${entry.tileCount} tiles (${percent.toFixed(1)}%)`;

            item.appendChild(swatch);
            item.appendChild(text);
            legend.appendChild(item);
        });

        const characterLegend = document.createElement('ul');
        characterLegend.className = 'leaderboard-legend';

        if (characterEntries.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'leaderboard-legend-item';
            const emptyText = document.createElement('span');
            emptyText.className = 'leaderboard-legend-text';
            emptyText.textContent = 'No character territory data yet.';
            emptyItem.appendChild(emptyText);
            characterLegend.appendChild(emptyItem);
        } else {
            characterEntries.forEach((entry) => {
                const item = document.createElement('li');
                item.className = 'leaderboard-legend-item';

                const avatar = document.createElement('img');
                avatar.className = 'leaderboard-character-avatar';
                avatar.alt = entry.avatarKey;
                avatar.loading = 'lazy';
                avatar.decoding = 'async';
                avatar.src = avatarUrlByKey.get(entry.avatarKey) ?? '';

                const percent = totalTiles === 0 ? 0 : (entry.tileCount / totalTiles) * 100;
                const text = document.createElement('span');
                text.className = 'leaderboard-legend-text';
                text.textContent = `${entry.tileCount} tiles (${percent.toFixed(1)}%)`;

                if (!avatar.src) {
                    text.textContent = `${entry.avatarKey} - ${text.textContent}`;
                }

                item.appendChild(avatar);
                item.appendChild(text);
                characterLegend.appendChild(item);
            });
        }

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'wager-button wager-button-primary leaderboard-close-button';
        closeButton.textContent = 'Close';
        closeButton.onclick = () => this.closeLeaderboardModal();

        const splitWrap = document.createElement('div');
        splitWrap.className = 'leaderboard-split-wrap';

        const factionPanel = document.createElement('section');
        factionPanel.className = 'leaderboard-panel';
        const factionPanelTitle = document.createElement('h3');
        factionPanelTitle.className = 'leaderboard-section-title';
        factionPanelTitle.textContent = 'Faction Leaderboard';
        factionPanel.appendChild(factionPanelTitle);
        factionPanel.appendChild(pieChart);
        factionPanel.appendChild(legend);

        const characterPanel = document.createElement('section');
        characterPanel.className = 'leaderboard-panel';
        const characterTitle = document.createElement('h3');
        characterTitle.className = 'leaderboard-section-title';
        characterTitle.textContent = 'Character Leaderboard';
        characterPanel.appendChild(characterTitle);
        characterPanel.appendChild(characterLegend);

        splitWrap.appendChild(factionPanel);
        splitWrap.appendChild(characterPanel);

        card.appendChild(topRow);
        card.appendChild(title);
        card.appendChild(leaderLine);
        card.appendChild(splitWrap);
        card.appendChild(closeButton);
        overlay.appendChild(card);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.closeLeaderboardModal();
            }
        });

        document.body.appendChild(overlay);
        this.activeLeaderboardModal = overlay;
    }

    closeLeaderboardModal() {
        if (!this.activeLeaderboardModal) return;
        this.activeLeaderboardModal.remove();
        this.activeLeaderboardModal = null;
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