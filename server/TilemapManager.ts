import type { Faction } from "../shared/types/factions";

export interface TileData {
    x: number;
    y: number;
    index: number;  // The tile index in the tileset
    properties?: Record<string, any>;
}

// Tile index constants that correspond to the generated tileset
export const TILE_INDICES = {
    EMPTY: 0,
    LAVENDER: 1,
    YELLOW: 2,
    BLUE: 3,
    PINK: 4,
} as const;

// Map faction names to tile indices
export const FACTION_TO_TILE_INDEX: Record<Faction, number> = {
    Lavender: TILE_INDICES.LAVENDER,
    Yellow: TILE_INDICES.YELLOW,
    Blue: TILE_INDICES.BLUE,
    Pink: TILE_INDICES.PINK,
};

export class TilemapManager {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    tileData: Map<string, TileData>;
    nextSpawnX: number;
    nextSpawnY: number;

    constructor(width: number, height: number, tileWidth: number, tileHeight: number) {
        this.width = width;
        this.height = height;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.tileData = new Map();
        this.nextSpawnX = 0;
        this.nextSpawnY = 0;
        this.initializeTiles();
    }

    private initializeTiles() {
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const key = `${x},${y}`;
                this.tileData.set(key, {
                    x,
                    y,
                    index: 0,  // 0 = empty/default tile
                    properties: {}
                });
            }
        }
    }

    getTile(x: number, y: number): TileData | undefined {
        const key = `${x},${y}`;
        return this.tileData.get(key);
    }

    putTile(x: number, y: number, index: number, properties?: Record<string, any>): TileData | undefined {
        const key = `${x},${y}`;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return undefined;
        }
        
        const tile: TileData = {
            x,
            y,
            index,
            properties: properties || {}
        };
        this.tileData.set(key, tile);
        return tile;
    }

    getAllTiles(): TileData[] {
        return Array.from(this.tileData.values());
    }

    getTilesByRegion(startX: number, startY: number, width: number, height: number): TileData[] {
        const result: TileData[] = [];
        for (let x = startX; x < startX + width; x++) {
            for (let y = startY; y < startY + height; y++) {
                const tile = this.getTile(x, y);
                if (tile) {
                    result.push(tile);
                }
            }
        }
        return result;
    }

    claimTiles(playerId: string, faction: Faction, tiles: Array<{x: number, y: number}>): TileData[] {
        const tileIndex = FACTION_TO_TILE_INDEX[faction];
        const claimedTiles: TileData[] = [];

        tiles.forEach(({ x, y }) => {
            const tile = this.getTile(x, y);
            if (tile) {
                // can claim others' tiles
                const updatedTile = this.putTile(x, y, tileIndex, {
                    owner: playerId,
                    faction
                });
                if (updatedTile) {
                    claimedTiles.push(updatedTile);
                }
            }
        });

        return claimedTiles;
    }

    unclaimTiles(tiles: Array<{x: number, y: number}>): TileData[] {
        const unclaimedTiles: TileData[] = [];

        tiles.forEach(({ x, y }) => {
            const updatedTile = this.putTile(x, y, TILE_INDICES.EMPTY, {
                owner: null,
                faction: null
            });
            if (updatedTile) {
                unclaimedTiles.push(updatedTile);
            }
        });

        return unclaimedTiles;
    }

    getTilesByOwner(playerId: string): TileData[] {
        return Array.from(this.tileData.values()).filter(tile => tile.properties?.owner === playerId);
    }

    allocateSpawnPatch(playerId: string, faction: Faction, patchSize: number): TileData[] {
        for (let startY = 0; startY <= this.height - patchSize; startY++) {
            for (let startX = 0; startX <= this.width - patchSize; startX++) {
                let ok = true;
                for (let dx = 0; dx < patchSize && ok; dx++) {
                    for (let dy = 0; dy < patchSize; dy++) {
                        const tx = startX + dx;
                        const ty = startY + dy;
                        const tile = this.getTile(tx, ty);
                        if (!tile || tile.index !== TILE_INDICES.EMPTY) {
                            ok = false;
                            break;
                        }
                    }
                }

                if (ok) {
                    const spawnTiles: Array<{ x: number; y: number }> = [];
                    for (let dx = 0; dx < patchSize; dx++) {
                        for (let dy = 0; dy < patchSize; dy++) {
                            spawnTiles.push({ x: startX + dx, y: startY + dy });
                        }
                    }

                    const claimedTiles = this.claimTiles(playerId, faction, spawnTiles);
                    return claimedTiles;
                }
            }
        }

        // No contiguous free patch found
        return [];
    }
}
