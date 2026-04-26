import type { GameScene } from "../GameScene";

export type MinigameDefinition = {
	id: string;
	name: string;
	description: string;
};

export const SLEEPOVER_MINIGAMES: MinigameDefinition[] = [
	{
		id: 'pillow-smash',
		name: 'Pillow Smash',
		description: 'Click the pillow as fast as you can for 5 seconds. Highest clicks wins.',
	},
];

export function pickRandomMinigame(): MinigameDefinition {
	const randomIndex = Math.floor(Math.random() * SLEEPOVER_MINIGAMES.length);
	return SLEEPOVER_MINIGAMES[randomIndex];
}

export abstract class Minigame {
	requestId: string;
	gameScene: GameScene;
	def: MinigameDefinition;

	constructor(requestId: string, gameScene: GameScene, def: MinigameDefinition) {
		this.requestId = requestId;
		this.gameScene = gameScene;
		this.def = def;
	}

	abstract setupSocketListeners: () => void;
}