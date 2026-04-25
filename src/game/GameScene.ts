import * as Phaser from "phaser";
import PlayerSprite from "./player/PlayerSprite";
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events'
import type { ScenePosition } from "./types";
import type { GameInitData } from "../../server/server";
import { preloadAvatarTextures } from "./utils/avatarLoader";

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
    
    // Tilemap
    tilemap: Phaser.Tilemaps.Tilemap | null;
    tilemapLayer: Phaser.Tilemaps.TilemapLayer | null;
    
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
        
        // Tilemap properties
        this.tilemap = null;
        this.tilemapLayer = null;
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
        this.physics.world.setBounds(0, 0, 1600, 1200);
        this.cameras.main.setBounds(0, 0, 1600, 1200);
        
        // Generate the tileset texture early
        this.generateTilesetTexture();
                
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
    }

    setupSocketListeners() {
        this.socket!.on('gameInit', (data: GameInitData) => {
            console.log('Game initialized:', data);
            
            // Create Phaser tilemap from server data
            this.createTilemapFromData(data.tilemap);
            
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
            if (this.tilemapLayer) {
                this.tilemapLayer.putTileAt(tileData.index, tileData.x, tileData.y);
            }
        });
        
        // Handle batch tile updates from server
        this.socket!.on('tilesUpdated', (tilesData) => {
            if (this.tilemapLayer) {
                tilesData.forEach(tile => {
                    this.tilemapLayer!.putTileAt(tile.index, tile.x, tile.y);
                });
            }
        });
        
        // Handle tiles claimed from server
        this.socket!.on('tilesClaimed', (tilesData) => {
            if (this.tilemapLayer) {
                tilesData.forEach(tile => {
                    this.tilemapLayer!.putTileAt(tile.index, tile.x, tile.y);
                    // Set properties on the tile
                    const tileObject = this.tilemapLayer!.getTileAt(tile.x, tile.y, false);
                    if (tileObject && tile.properties) {
                        tileObject.properties = tile.properties;
                    }
                });
            }
        });
        
        // Handle tiles unclaimed from server
        this.socket!.on('tilesUnclaimed', (tilesData) => {
            if (this.tilemapLayer) {
                tilesData.forEach(tile => {
                    this.tilemapLayer!.putTileAt(tile.index, tile.x, tile.y);
                    // Clear properties on the tile
                    const tileObject = this.tilemapLayer!.getTileAt(tile.x, tile.y, false);
                    if (tileObject) {
                        tileObject.properties = tile.properties || { owner: null, faction: null };
                    }
                });
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

    generateTilesetTexture() {
        // Import faction colors
        const FACTION_COLORS = {
            Lavender: 0xB497BD,
            Yellow: 0xF7E967,
            Blue: 0x4DA6FF,
            Pink: 0xFF8FC0,
        };

        const TILE_SIZE = 32;
        const NUM_TILES = 5; // 0=empty, 1=Lavender, 2=Yellow, 3=Blue, 4=Pink
        const TILESET_WIDTH = TILE_SIZE * NUM_TILES;
        const TILESET_HEIGHT = TILE_SIZE;

        // Create a render texture for the tileset
        const texture = this.textures.createCanvas('tileset', TILESET_WIDTH, TILESET_HEIGHT);
        if (!texture) {
            console.warn('Failed to create tileset texture');
            return;
        }
        console.log('Tileset texture created:', texture);
        const ctx = texture.getContext();

        // Draw tiles
        // Tile 0: Empty (light gray)
        ctx.fillStyle = '#EEEEEE';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Tile 1: Lavender
        ctx.fillStyle = `#${FACTION_COLORS.Lavender.toString(16).padStart(6, '0')}`;
        ctx.fillRect(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.strokeRect(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);

        // Tile 2: Yellow
        ctx.fillStyle = `#${FACTION_COLORS.Yellow.toString(16).padStart(6, '0')}`;
        ctx.fillRect(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.strokeRect(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE);

        // Tile 3: Blue
        ctx.fillStyle = `#${FACTION_COLORS.Blue.toString(16).padStart(6, '0')}`;
        ctx.fillRect(TILE_SIZE * 3, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.strokeRect(TILE_SIZE * 3, 0, TILE_SIZE, TILE_SIZE);

        // Tile 4: Pink
        ctx.fillStyle = `#${FACTION_COLORS.Pink.toString(16).padStart(6, '0')}`;
        ctx.fillRect(TILE_SIZE * 4, 0, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.strokeRect(TILE_SIZE * 4, 0, TILE_SIZE, TILE_SIZE);

        texture.refresh();
        console.log('Tileset texture refreshed');
    }

    createTilemapFromData(tilemapData: { tiles: Array<{x: number, y: number, index: number, properties?: Record<string, any>}>; width: number; height: number; tileWidth: number; tileHeight: number }) {
        // Create tilemap with just the basic config (no layers yet)
        const mapData = {
            width: tilemapData.width,
            height: tilemapData.height,
            tileWidth: tilemapData.tileWidth,
            tileHeight: tilemapData.tileHeight,
            layers: [],
            tilesets: [],
            orientation: 'orthogonal',
            renderorder: 'right-down'
        } as any;

        this.tilemap = this.make.tilemap({ data: mapData as any });
        console.log('Tilemap created with dimensions:', tilemapData.width, 'x', tilemapData.height);
        
        // Add the generated tileset image
        const tileset = this.tilemap.addTilesetImage('tileset', 'tileset', 32, 32, 0, 0);
        console.log('Tileset added:', tileset);
        
        if (tileset) {
            // Create a blank layer instead of trying to create from existing data
            const layer = this.tilemap.createBlankLayer('terrain', tileset, 0, 0, tilemapData.width, tilemapData.height);
            console.log('Layer created:', layer);
            
            if (layer) {
                this.tilemapLayer = layer;
                this.tilemapLayer.setDepth(0);
                console.log('TilemapLayer assigned and set to depth 0');
                
                // Now populate the layer with tiles from server
                tilemapData.tiles.forEach(tile => {
                    this.tilemapLayer!.putTileAt(tile.index, tile.x, tile.y);
                    
                    // Set properties on the tile
                    if (tile.properties) {
                        const tileObject = this.tilemapLayer!.getTileAt(tile.x, tile.y, false);
                        if (tileObject) {
                            tileObject.properties = tile.properties;
                        }
                    }
                });
                console.log(`Populated ${tilemapData.tiles.length} tiles to tilemap layer`);
            }
        } else {
            console.warn('Failed to add tileset image');
        }

        if (!this.tilemapLayer) {
            console.warn('Failed to create tilemap layer');
        }
    }


    updateTileOnServer(x: number, y: number, index: number, properties?: Record<string, any>) {
        if (!this.socket) return;
        
        this.socket.emit('tileUpdate', {
            x,
            y,
            index,
            properties
        });
    }

    updateTilesOnServer(tilesData: Array<{x: number, y: number, index: number, properties?: Record<string, any>}>) {
        if (!this.socket) return;
        
        this.socket.emit('tilesUpdate', tilesData);
    }

    claimTiles(tiles: Array<{x: number, y: number}>) {
        if (!this.socket) return;
        
        this.socket.emit('claimTiles', tiles);
    }

    unclaimTiles(tiles: Array<{x: number, y: number}>) {
        if (!this.socket) return;
        
        this.socket.emit('unclaimTiles', tiles);
    }

    getOwnedTiles(playerId: string): Array<{x: number, y: number}> {
        const ownedTiles: Array<{x: number, y: number}> = [];
        
        if (!this.tilemapLayer) return ownedTiles;
        
        // Get all tiles in the layer and check their properties
        const layer = this.tilemapLayer.layer;
        for (let x = 0; x < layer.width; x++) {
            for (let y = 0; y < layer.height; y++) {
                const tile = this.tilemapLayer.getTileAt(x, y, false);
                if (tile && tile.properties?.owner === playerId) {
                    ownedTiles.push({ x, y });
                }
            }
        }
        
        return ownedTiles;
    }

    getTileOwner(x: number, y: number): string | null {
        if (!this.tilemapLayer) return null;
        
        const tile = this.tilemapLayer.getTileAt(x, y, false);
        return tile?.properties?.owner || null;
    }
  }