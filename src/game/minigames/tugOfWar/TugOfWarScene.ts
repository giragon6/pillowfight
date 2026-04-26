import { MinigameScene } from "../MinigameScene";
import type { TugOfWar } from "./TugOfWar";

export class TugOfWarScene extends MinigameScene {
    declare minigame: TugOfWar;    
    gamePanel!: Phaser.GameObjects.Rectangle;
    x!: number;
    y!: number;
    
    create() {
        super.create()
        this.input.keyboard?.on('keyup', () => this.minigame.pull())
        const createPanelRes = this.createPanel();
        this.gamePanel = createPanelRes.panel;
        this.x = createPanelRes.x;
        this.y = createPanelRes.y;
        this.add.image(this.x+10, this.y+10, this.gameScene.currentPlayer?.texture as Phaser.Textures.Texture);
    }

    update() {
        this.minigame.update();
    }
}