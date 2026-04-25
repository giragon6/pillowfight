import type { Faction } from '../shared/types/factions';

interface TileState {
  faction: Faction | undefined;
  owner: string | undefined;
  contents: any[];
}

export class ServerTileMapManager {
  private tiles: Map<string, TileState>;
  readonly width: number;
  readonly height: number;
  private tileChangeCallbacks: Array<(x: number, y: number, tile: TileState) => void> = [];
  private batchChangeCallbacks: Array<(changes: Array<{x: number, y: number, tile: TileState}>) => void> = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = new Map();

    // Initialize all tiles as empty
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = this.getTileKey(x, y);
        this.tiles.set(key, {
          faction: undefined,
          owner: undefined,
          contents: [],
        });
      }
    }
  }

  private getTileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private getTile(x: number, y: number): TileState | null {
    if (!this.isValidPosition(x, y)) return null;
    return this.tiles.get(this.getTileKey(x, y)) ?? null;
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Register a callback to be called when a tile changes
   */
  onTileChange(callback: (x: number, y: number, tile: TileState) => void): void {
    this.tileChangeCallbacks.push(callback);
  }

  /**
   * Register a callback to be called when multiple tiles change
   */
  onBatchChange(callback: (changes: Array<{x: number, y: number, tile: TileState}>) => void): void {
    this.batchChangeCallbacks.push(callback);
  }

  /**
   * Gets the faction of a tile
   */
  getFaction(x: number, y: number): Faction | undefined {
    return this.getTile(x, y)?.faction;
  }

  /**
   * Sets the faction of a tile
   */
  setFaction(x: number, y: number, faction: Faction | undefined): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.faction = faction;
      this.notifyChange(x, y);
    }
  }

  /**
   * Gets the owner (playerId) of a tile
   */
  getOwner(x: number, y: number): string | undefined {
    return this.getTile(x, y)?.owner;
  }

  /**
   * Sets the owner (playerId) of a tile
   */
  setOwner(x: number, y: number, playerId: string | undefined): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.owner = playerId;
      this.notifyChange(x, y);
    }
  }

  /**
   * Gets the contents array of a tile
   */
  getContents(x: number, y: number): any[] {
    return this.getTile(x, y)?.contents ?? [];
  }

  /**
   * Sets the contents array of a tile
   */
  setContents(x: number, y: number, contents: any[]): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.contents = contents;
      this.notifyChange(x, y);
    }
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
  getFactionTilePercentages(): Record<'Lavender' | 'Yellow' | 'Blue' | 'Pink' | 'Empty', number> {
    const totalTiles = this.width * this.height;
    const counts: Record<'Lavender' | 'Yellow' | 'Blue' | 'Pink' | 'Empty', number> = {
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

    const percentages: Record<'Lavender' | 'Yellow' | 'Blue' | 'Pink' | 'Empty', number> = {
      Lavender: counts.Lavender / totalTiles,
      Yellow: counts.Yellow / totalTiles,
      Blue: counts.Blue / totalTiles,
      Pink: counts.Pink / totalTiles,
      Empty: counts.Empty / totalTiles,
    };

    return percentages;
  }

  /**
   * Notifies all listeners of a tile change
   */
  private notifyChange(x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (tile) {
      this.tileChangeCallbacks.forEach(callback => callback(x, y, tile));
    }
  }

  /**
   * Notifies all listeners of batch changes
   */
  notifyBatchChange(changes: Array<{x: number, y: number}>): void {
    const tileChanges = changes
      .map(({x, y}) => ({x, y, tile: this.getTile(x, y)!}))
      .filter(change => change.tile !== null);
    
    this.batchChangeCallbacks.forEach(callback => callback(tileChanges));
  }
}
