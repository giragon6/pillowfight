import * as Phaser from 'phaser';
import type { Faction } from "../../../shared/types/factions";
import type { PlayerData } from "../../../shared/types/playerTypes";
import { getFactionColor } from "../../../shared/factionColors";

export default class PlayerSprite extends Phaser.Physics.Arcade.Sprite {
    scene: Phaser.Scene;
    playerId: string;
    isCurrentPlayer: boolean;
    faction: Faction;
    avatarKey: string;
    soundKey: string;
    playerName: string;
    tintColor: number;
    radius: number;
    nameText: Phaser.GameObjects.Text;
    
    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string, isCurrentPlayer: boolean, playerData: PlayerData) {  
        const avatarKey = playerData.avatar;      

        super(scene, x, y, avatarKey);

        this.scene = scene;
        this.playerId = playerId;
        this.isCurrentPlayer = isCurrentPlayer;
        this.faction = playerData.faction;
        this.avatarKey = avatarKey;
        
        // Debug: Log texture info
        const texture = scene.textures.get(avatarKey);
        console.log(`Creating sprite with avatar key "${avatarKey}"`);
        console.log(`Texture exists: ${texture && texture.key === avatarKey}`);
        console.log(`Available textures:`, scene.textures.getTextureKeys().filter(k => k.includes('avatar') || k === avatarKey));
        
        this.soundKey = playerData.sound;

        this.radius = 15;

        this.playerName = playerData.username || (isCurrentPlayer ? 'You' : playerId.substring(0, 8));
        
        this.tintColor = getFactionColor(this.faction);
        this.setTint(this.tintColor);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.body!.setCircle(this.radius);
        
        this.setOrigin(0.5, 0.5);
        
        this.nameText = scene.add.text(x, y - 35, this.playerName, {
            fontSize: '12px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.nameText.setOrigin(0.5, 0.5);
    }

    updatePosition(x: number, y: number) {
        this.setPosition(x, y);
        this.nameText.setPosition(x, y - 35);
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (this.nameText) {
            this.nameText.setPosition(this.x, this.y - 35);
        }
    }

    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        super.destroy();
    }
}