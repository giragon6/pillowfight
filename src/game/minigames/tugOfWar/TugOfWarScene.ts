import { MinigameScene } from "../MinigameScene";
import type { TugOfWar } from "./TugOfWar";

export class TugOfWarScene extends MinigameScene {
    declare minigame: TugOfWar;    
    gamePanel!: Phaser.GameObjects.Rectangle;
    x!: number;
    y!: number;
    private onKeyUp = () => { this.minigame.pull() };
    me!: Phaser.GameObjects.Image;
    opp!: Phaser.GameObjects.Image;
    rope!: Phaser.GameObjects.Rectangle;
    
    create() {
        super.create()
        console.log("Tug of War: Instantiated scene")
        this.input.keyboard?.on('keyup', this.onKeyUp)
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keyup', this.onKeyUp)
        })
        const createPanelRes = this.createPanel(this.gameScene.scale.width * 0.8, this.gameScene.scale.height*0.7);
        this.gamePanel = createPanelRes.panel;
        this.x = createPanelRes.x;
        this.y = createPanelRes.y;

        const avatarSize = 96;
        const centerY = this.y + this.gamePanel.height / 2;
        const leftX = this.x + this.gamePanel.width * 0.25;
        const rightX = this.x + this.gamePanel.width * 0.75;

        this.me = this.add.image(leftX, centerY, this.minigame.sceneContext.currentPlayerAvatarKey);
        this.me.setDisplaySize(avatarSize, avatarSize);
        this.me.setOrigin(0.5, 0.5);

        this.opp = this.add.image(rightX, centerY, this.minigame.sceneContext.opponentPlayerAvatarKey);
        this.opp.setDisplaySize(avatarSize, avatarSize);
        this.opp.setOrigin(0.5, 0.5);

        this.rope = this.add.rectangle((leftX + rightX) / 2, centerY, leftX - rightX, 8, 0xd7b58c);
        this.rope.setOrigin(0.5, 0.5);
    }

    adjustRope(pulls: number) {
        const pullsMult = pulls * 10;
        this.rope.x -= pullsMult;
        this.me.x -= pullsMult;
        this.opp.x -= pullsMult;
    }

    update() {
        this.minigame.update();
    }
}