import * as Phaser from 'phaser';
import type { GameScene } from '../GameScene';

export abstract class MinigameScene extends Phaser.Scene {
	gameScene: GameScene;

	constructor(key: string, gameScene: GameScene) {
		super({ key });
        this.gameScene = gameScene;
	}

	create() {
		// default overlay background that blocks input to game below
		const { width, height } = this.scale;

		const blocker = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0);
		blocker.setScrollFactor(0);
		blocker.setInteractive();

		// simple close hook — subclasses can override or call `close()` themselves
		this.events.on('shutdown', () => {
			// no-op by default
		});
	}

	// Closes this minigame overlay and resumes the GameScene
	close() {
		// stop this scene which will trigger 'shutdown' and allow the caller to resume/cleanup
		this.scene.stop();
	}

	// Helper to add a titled panel fixed to the viewport
	protected createPanel(width = 400, height = 280, x?: number, y?: number) {
		const vw = this.scale.width;
		const vh = this.scale.height;
		const px = x ?? vw / 2 - width / 2;
		const py = y ?? vh / 2 - height / 2;

		const panel = this.add.rectangle(px + width / 2, py + height / 2, width, height, 0x151515, 0.95);
		panel.setScrollFactor(0);
		panel.setStrokeStyle(2, 0x888888);
		return { panel, x: px, y: py };
	}
}
