import type { GameScene } from "../GameScene";
import type { MinigameScene } from "./MinigameScene";
import { TugOfWarScene } from "./tugOfWar/TugOfWarScene";

export type MinigameDefinition = {
	id: string;
	name: string;
	description: string;
};

export const MINIGAMES: MinigameDefinition[] = [
	{
		id: 'tow',
		name: 'Tug of War',
		description: 'Click as fast as you can.',
	},
];

export const MINIGAME_SCENES: Record<string, typeof MinigameScene> = {
  tow: TugOfWarScene
};

export function pickRandomMinigame(): MinigameDefinition {
	const randomIndex = Math.floor(Math.random() * MINIGAMES.length);
	return MINIGAMES[randomIndex];
}

export abstract class Minigame {
	requestId: string;
	gameScene: GameScene;
	minigameScene: MinigameScene | null;
	def: MinigameDefinition;

	constructor(
		requestId: string, 
		gameScene: GameScene, 
		def: MinigameDefinition,
	) {
		this.requestId = requestId;
		this.gameScene = gameScene;
		this.def = def;
		this.minigameScene = null;
		const minigameSceneType = MINIGAME_SCENES[this.def.id];
		if (minigameSceneType) {
			//@ts-ignore
			this.minigameScene = new minigameSceneType(this.def.id, this.gameScene);
		}
	}

	abstract setupSocketListeners(): void;
}
