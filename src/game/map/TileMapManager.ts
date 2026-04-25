import * as Phaser from 'phaser';
import type { Faction } from '../../../shared/types/factions';
import { FACTION_COLORS } from '../../../shared/factionColors';

export class TileMapManager {
  readonly scene: Phaser.Scene;
  readonly tilemap: Phaser.Tilemaps.Tilemap;
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  readonly width: number;
  readonly height: number;
  private readonly tileSize = 32;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    console.log('TileMapManager creating tileset texture...');
    // Create tileset texture from faction colors
    this.createTilesetTexture();
    console.log('Tileset texture created');

    console.log('TileMapManager creating tilemap and layer...');
    // Create tilemap and layer
    const { tilemap, layer } = this.createTilemapAndLayer();
    this.tilemap = tilemap;
    this.layer = layer;
    console.log('Tilemap and layer created');
    
    // Set layer to visible
    this.layer.setVisible(true);
    this.layer.setDepth(0);

    console.log('TileMapManager initializing tiles...');
    // Initialize all tiles as empty
    this.initializeTiles();
    console.log('TileMapManager initialized successfully');
  }

  /**
   * Creates a dynamic tileset texture with colors for each faction and empty tiles
   */
  private createTilesetTexture(): void {
    try {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
      const factions: Faction[] = ['Lavender', 'Yellow', 'Blue', 'Pink'];
      const textureWidth = (factions.length + 1) * this.tileSize;
      const textureHeight = this.tileSize;
      console.log('Creating tileset texture, size:', textureWidth, 'x', textureHeight);

      // Tile 0: Empty (light gray)
      graphics.fillStyle(0xcccccc);
      graphics.fillRect(0, 0, this.tileSize, this.tileSize);
      graphics.lineStyle(2, 0x000000);
      graphics.strokeRect(0, 0, this.tileSize, this.tileSize);

      // Tiles 1-4: Faction colors
      factions.forEach((faction, index) => {
        const color = FACTION_COLORS[faction];
        graphics.fillStyle(color);
        graphics.fillRect(
          (index + 1) * this.tileSize,
          0,
          this.tileSize,
          this.tileSize
        );
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRect(
          (index + 1) * this.tileSize,
          0,
          this.tileSize,
          this.tileSize
        );
      });

      graphics.generateTexture('factionTileset', textureWidth, textureHeight);
      graphics.destroy();
      console.log('Tileset texture generated successfully');
    } catch (error) {
      console.error('Error creating tileset texture:', error);
      throw error;
    }
  }

  /**
   * Creates the Phaser tilemap and its layer
   */
  private createTilemapAndLayer(): {
    tilemap: Phaser.Tilemaps.Tilemap;
    layer: Phaser.Tilemaps.TilemapLayer;
  } {
    const tilemap = this.scene.make.tilemap({
      width: this.width,
      height: this.height,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize,
    });

    const tileset = tilemap.addTilesetImage(
      'factionTileset',
      'factionTileset',
      this.tileSize,
      this.tileSize,
      0,
      0
    );

    if (!tileset) {
      throw new Error('Failed to add tileset to tilemap');
    }

    const layer = tilemap.createBlankLayer(
      'tiles',
      tileset,
      0,
      0,
      this.width,
      this.height
    );

    if (!layer) {
      throw new Error('Failed to create tilemap layer');
    }

    return { tilemap, layer };
  }

  /**
   * Initializes all tiles with default properties (empty)
   */
  private initializeTiles(): void {
    // Fill layer with empty tile (ID 0)
    this.layer.fill(0);

    // Initialize tile properties
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.layer.getTileAt(x, y);
        if (tile) {
          tile.properties = {
            faction: undefined,
            owner: undefined,
            contents: [],
          };
        }
      }
    }
  }

  /**
   * Gets the faction of a tile
   */
  getFaction(x: number, y: number): Faction | undefined {
    const tile = this.layer.getTileAt(x, y);
    return tile?.properties?.faction as Faction | undefined;
  }

  /**
   * Sets the faction of a tile and updates its visual representation
   */
  setFaction(x: number, y: number, faction: Faction | undefined): void {
    const tile = this.layer.getTileAt(x, y);
    if (tile) {
      tile.properties.faction = faction;
      this.updateTileVisual(x, y);
    }
  }

  /**
   * Gets the owner (playerId) of a tile
   */
  getOwner(x: number, y: number): string | undefined {
    const tile = this.layer.getTileAt(x, y);
    return tile?.properties?.owner as string | undefined;
  }

  /**
   * Sets the owner (playerId) of a tile
   */
  setOwner(x: number, y: number, playerId: string | undefined): void {
    const tile = this.layer.getTileAt(x, y);
    if (tile) {
      tile.properties.owner = playerId;
    }
  }

  /**
   * Gets the contents array of a tile
   */
  getContents(x: number, y: number): any[] {
    const tile = this.layer.getTileAt(x, y);
    return tile?.properties?.contents ?? [];
  }

  /**
   * Sets the contents array of a tile
   */
  setContents(x: number, y: number, contents: any[]): void {
    const tile = this.layer.getTileAt(x, y);
    if (tile) {
      tile.properties.contents = contents;
    }
  }

  /**
   * Updates the tile's visual representation based on its faction
   */
  private updateTileVisual(x: number, y: number): void {
    const faction = this.getFaction(x, y);
    const factions: Faction[] = ['Lavender', 'Yellow', 'Blue', 'Pink'];
    const tileId = faction ? factions.indexOf(faction) + 1 : 0;
    this.layer.putTileAt(tileId, x, y);
  }

  /**
   * Gets all tiles belonging to a specific player
   */
  getTilesByPlayer(playerId: string): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getOwner(x, y) === playerId) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  /**
   * Gets all tiles belonging to a specific faction
   */
  getTilesByFaction(faction: Faction): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getFaction(x, y) === faction) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  /**
   * Gets the fraction (0-1) of total tiles that belong to each faction
   */
  getFactionTilePercentages(): Record<Faction | 'Empty', number> {
    const totalTiles = this.width * this.height;
    const counts: Record<Faction | 'Empty', number> = {
      Lavender: 0,
      Yellow: 0,
      Blue: 0,
      Pink: 0,
      Empty: 0,
    };

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const faction = this.getFaction(x, y);
        if (faction) {
          counts[faction]++;
        } else {
          counts.Empty++;
        }
      }
    }

    const percentages: Record<Faction | 'Empty', number> = {
      Lavender: counts.Lavender / totalTiles,
      Yellow: counts.Yellow / totalTiles,
      Blue: counts.Blue / totalTiles,
      Pink: counts.Pink / totalTiles,
      Empty: counts.Empty / totalTiles,
    };

    return percentages;
  }
}
