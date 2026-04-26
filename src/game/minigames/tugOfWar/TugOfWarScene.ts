import { MinigameScene } from "../MinigameScene";
import type { TugOfWar } from "./TugOfWar";

export class TugOfWarScene extends MinigameScene {
    declare minigame: TugOfWar;    
    gamePanel!: Phaser.GameObjects.Rectangle;
    x!: number;
    y!: number;
    private onKeyUp = () => this.minigame.pull();
    // me: Phaser.GameObjects.Image;
    // opp: Phaser.GameObjects.Image;
    
    create() {
        super.create()
        console.log("Tug of War: Instantiated scene")
        this.input.keyboard?.on('keyup', this.onKeyUp)
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keyup', this.onKeyUp)
        })
        const createPanelRes = this.createPanel();
        this.gamePanel = createPanelRes.panel;
        this.x = createPanelRes.x;
        this.y = createPanelRes.y;
        // this.me = this.add.image(this.x+10, this.y+10, this.gameScene.currentPlayer?.texture as Phaser.Textures.Texture);
        // this.opp = this.add.image(this.x+10, this.y+10, this.gameScene.currentPlayer?.texture as Phaser.Textures.Texture);
    }

    update() {
        this.minigame.update();
    }
}