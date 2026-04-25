import FACTION_COLORS from "../../shared/factionColors";
import type { GameScene } from "../game/GameScene";

export class GameMap {
    scene: GameScene;

    tilemap: Phaser.Tilemaps.Tilemap | null;
    tilemapLayer: Phaser.Tilemaps.TilemapLayer | null;

    tileWidth: number | undefined;
    tileHeight: number | undefined;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.tilemap = null;
        this.tilemapLayer = null;
    }

    putTileAt(ind: number, x: number, y: number) {
        if (this.tilemapLayer) {
            this.tilemapLayer.putTileAt(ind, x, y);
        }
    }

    getTileAt(x: number, y: number, nonnull?: boolean) {
        if (this.tilemapLayer) {
            return this.tilemapLayer.getTileAt(x, y, nonnull);
        }
    }

    generateTilesetTexture(tileWidth: number, tileHeight: number) {
        const NUM_TILES = 5; // 0=empty, 1=Lavender, 2=Yellow, 3=Blue, 4=Pink
        const TILESET_WIDTH = tileWidth * NUM_TILES;
        const TILESET_HEIGHT = tileHeight;

        // Destroy old tileset texture if it exists to ensure clean regeneration
        if (this.scene.textures.exists('tileset')) {
            this.scene.textures.remove('tileset');
        }

        // Create a render texture for the tileset
        const texture = this.scene.textures.createCanvas('tileset', TILESET_WIDTH, TILESET_HEIGHT);
        if (!texture) {
            console.warn('Failed to create tileset texture');
            return;
        }
        console.log('Tileset texture created:', texture);
        const ctx = texture.getContext();
        
        // Set up canvas rendering to avoid pixel anti-aliasing issues
        ctx.imageSmoothingEnabled = false;

        // Draw tiles
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        
        // Tile 0: Empty (light gray)
        ctx.fillStyle = '#EEEEEE';
        ctx.fillRect(0, 0, tileWidth, tileHeight);
        ctx.strokeRect(0.5, 0.5, tileWidth - 1, tileHeight - 1);

        // Tile 1: Lavender
        ctx.fillStyle = `#${FACTION_COLORS.Lavender.toString(16).padStart(6, '0')}`;
        ctx.fillRect(tileWidth, 0, tileWidth, tileHeight);
        ctx.strokeRect(tileWidth + 0.5, 0.5, tileWidth - 1, tileHeight - 1);

        // Tile 2: Yellow
        ctx.fillStyle = `#${FACTION_COLORS.Yellow.toString(16).padStart(6, '0')}`;
        ctx.fillRect(tileWidth * 2, 0, tileWidth, tileHeight);
        ctx.strokeRect(tileWidth * 2 + 0.5, 0.5, tileWidth - 1, tileHeight - 1);

        // Tile 3: Blue
        ctx.fillStyle = `#${FACTION_COLORS.Blue.toString(16).padStart(6, '0')}`;
        ctx.fillRect(tileWidth * 3, 0, tileWidth, tileHeight);
        ctx.strokeRect(tileWidth * 3 + 0.5, 0.5, tileWidth - 1, tileHeight - 1);

        // Tile 4: Pink
        ctx.fillStyle = `#${FACTION_COLORS.Pink.toString(16).padStart(6, '0')}`;
        ctx.fillRect(tileWidth * 4, 0, tileWidth, tileHeight);
        ctx.strokeRect(tileWidth * 4 + 0.5, 0.5, tileWidth - 1, tileHeight - 1);

        texture.refresh();
        console.log('Tileset texture refreshed');
    }

    createTilemapFromData(tilemapData: { tiles: Array<{x: number, y: number, index: number, properties?: Record<string, any>}>; width: number; height: number; tileWidth: number; tileHeight: number }) {
        this.tileWidth = tilemapData.tileWidth;
        this.tileHeight = tilemapData.tileHeight;
        this.generateTilesetTexture(this.tileWidth, this.tileHeight);
        
        this.tilemap = this.scene.make.tilemap({
            width: tilemapData.width,
            height: tilemapData.height,
            tileWidth: tilemapData.tileWidth,
            tileHeight: tilemapData.tileHeight
        } as any);
        console.log('Tilemap created with dimensions:', tilemapData.width, 'x', tilemapData.height, 'tileSize:', tilemapData.tileWidth, 'x', tilemapData.tileHeight);
        
        // Add the generated tileset image
        const tileset = this.tilemap.addTilesetImage('tileset', 'tileset', tilemapData.tileWidth, tilemapData.tileHeight, 0, 0);
        console.log('Tileset added:', tileset);
        
        if (tileset) {
            // Create a blank layer instead of trying to create from existing data
            const layer = this.tilemap.createBlankLayer('terrain', tileset, 0, 0, tilemapData.width, tilemapData.height, tilemapData.tileWidth, tilemapData.tileHeight);
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

        const tex = this.scene.textures.get('tileset');
        if (tex && typeof (tex as any).setFilter === 'function') {
            // Phaser.Textures.FilterMode.NEAREST === 0
            (tex as any).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        if (!this.tilemapLayer) {
            console.warn('Failed to create tilemap layer');
        }
    }

    // updateTileOnServer(x: number, y: number, index: number, properties?: Record<string, any>) {
    //     if (!this.scene.socket) return;
        
    //     this.scene.socket.emit('tileUpdate', {
    //         x,
    //         y,
    //         index,
    //         properties
    //     });
    // }

    // updateTilesOnServer(tilesData: Array<{x: number, y: number, index: number, properties?: Record<string, any>}>) {
    //     if (!this.scene.socket) return;
        
    //     this.scene.socket.emit('tilesUpdate', tilesData);
    // }

    claimTiles(tiles: Array<{x: number, y: number}>) {
        if (!this.scene.socket) return;
        
        this.scene.socket.emit('claimTiles', tiles);
    }

    unclaimTiles(tiles: Array<{x: number, y: number}>) {
        if (!this.scene.socket) return;
        
        this.scene.socket.emit('unclaimTiles', tiles);
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