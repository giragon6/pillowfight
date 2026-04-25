import PlayerSprite from "./player/PlayerSprite";
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events'
import type { ScenePosition } from "./types";
import type { GameInitData } from "../../server/server";

export class GameScene extends Phaser.Scene {
    players: Map<string, PlayerSprite>;
    currentPlayer: PlayerSprite | null;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    isReady: boolean;
    wasd: object | null;
    playerGroup: Phaser.Physics.Arcade.Group | null;

    //Click to move
    targetPosition: ScenePosition | null;
    moveSpeed: number;
    clickIndicator: Phaser.GameObjects.Graphics | null;
    isMobile: boolean;
    
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
    }

    initialize(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;
        this.setupSocketListeners();
    }

    preload() {
        // todo: add assets
    }

    create() {        
        this.physics.world.setBounds(0, 0, 1600, 1200);
        this.cameras.main.setBounds(0, 0, 1600, 1200);
                
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D');
        
        // Set up click-to-move for mobile and desktop
        this.input.on('pointerdown', this.handlePointerDown, this);
        
        // Create click indicator
        this.clickIndicator = this.add.graphics();
        this.clickIndicator.setDepth(1000);
        this.clickIndicator.setVisible(false);
        
        // Mark scene as ready
        this.isReady = true;
        console.log('GameScene is ready');
    }

    setupSocketListeners() {
        this.socket!.on('gameInit', (data: GameInitData) => {
            console.log('Game initialized:', data);

            // Get player data from pending customization
            const playerData = window.pendingPlayerData || { name: 'Player', color: 0x3498db };
            
            // Create current player with custom data
            this.currentPlayer = new PlayerSprite(this, data.player.x, data.player.y, data.playerId, true, playerData);
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
            // Now show the game UI
            window.showGame();
        });

        this.socket!.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            const playerSprite = new PlayerSprite(this, playerData.x, playerData.y, playerData.id, false, playerData);
            this.players.set(playerData.id, playerSprite);
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
        
        this.targetPosition = { x: worldPoint.x, y: worldPoint.y };
        this.showClickIndicator(worldPoint.x, worldPoint.y);
    }

    checkPlayerClick(worldX: number, worldY: number) {
        // Check if click position is near any player
        for (let [playerId, player] of this.players) {
            const distance = Phaser.Math.Distance.Between(worldX, worldY, player.x, player.y);
            if (distance <= 40) { // 40 pixel radius for clicking on players
                return player;
            }
        }
        return null;
    }

    showClickIndicator(x: number, y: number) {
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
  }