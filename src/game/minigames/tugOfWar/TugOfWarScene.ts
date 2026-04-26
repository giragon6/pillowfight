import { MinigameScene } from "../MinigameScene";
import type { TugOfWar } from "./TugOfWar";

export class TugOfWarScene extends MinigameScene {
    declare minigame: TugOfWar;    
    backgroundBase!: Phaser.GameObjects.Rectangle;
    backgroundGlow!: Phaser.GameObjects.Ellipse;
    backgroundGlow2!: Phaser.GameObjects.Ellipse;
    backgroundDots!: Phaser.GameObjects.Ellipse[];
    gamePanel!: Phaser.GameObjects.Rectangle;
    instructionPanel!: Phaser.GameObjects.Rectangle;
    x!: number;
    y!: number;
    private onKeyUp = () => { this.minigame.pull(); };
    private onPointerDown = () => { this.minigame.pull(); };
    me!: Phaser.GameObjects.Image;
    opp!: Phaser.GameObjects.Image;
    rope!: Phaser.GameObjects.Rectangle;
    
    create() {
        super.create()
        console.log("Tug of War: Instantiated scene")
        this.input.keyboard?.on('keyup', this.onKeyUp)
        this.input.on('pointerdown', this.onPointerDown)
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keyup', this.onKeyUp)
            this.input.off('pointerdown', this.onPointerDown)
        })
        const createPanelRes = this.createPanel(this.gameScene.scale.width * 0.8, this.gameScene.scale.height*0.7);
        this.gamePanel = createPanelRes.panel;
        this.gamePanel.setAlpha(0.68);
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

        const instructionsY = this.y + this.gamePanel.height + 16;
        const instructionsHeight = Math.max(96, this.gameScene.scale.height - instructionsY - 24);
        const instructionsWidth = this.gamePanel.width;
        const instructionsCenterY = instructionsY + instructionsHeight / 2;

        this.instructionPanel = this.add.rectangle(
            this.x + instructionsWidth / 2,
            instructionsCenterY,
            instructionsWidth,
            instructionsHeight,
            0x1b1423,
            0.92
        );
        this.instructionPanel.setStrokeStyle(2, 0x8b63b8, 1);
        this.instructionPanel.setOrigin(0.5, 0.5);

        const instructionTitle = this.add.text(this.x + 18, instructionsY + 12, 'Instructions', {
            fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, Verdana, sans-serif',
            fontSize: '22px',
            color: '#ffffff',
        });

        const instructionBody = this.add.text(
            this.x + 18,
            instructionsY + 42,
            'Press any key or click anywhere to pull the rope',
            {
                fontFamily: 'Trebuchet MS, Verdana, sans-serif',
                fontSize: '18px',
                color: '#f0e6ff',
                wordWrap: { width: instructionsWidth - 36 },
                lineSpacing: 8,
            }
        );

        instructionTitle.setScrollFactor(0);
        instructionBody.setScrollFactor(0);
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