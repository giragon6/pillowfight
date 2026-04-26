import type { MinigameStartedEvent } from "../../../server/events";
import type { GameScene } from "../GameScene";
import type { MinigameScene } from "./MinigameScene";
import { TugOfWarScene } from "./tugOfWar/TugOfWarScene";

export type MinigameDefinition = {
	id: string;
	name: string;
	description: string;
};

export type MinigameEndToastContext = {
	minigameName: string;
	myScore: number;
	opponentScore: number;
	opponentName: string;
	winnerPlayerId: string | null;
	currentPlayerId: string;
	currentPlayerName: string;
};

export type SceneMinigameContext = {
	currentPlayerId: string;
	currentPlayerName: string;
	currentPlayerAvatarKey: string;
	opponentPlayerId: string;
	opponentPlayerName: string;
	opponentPlayerAvatarKey: string;
};

export const MINIGAMES: MinigameDefinition[] = [
	{
		id: 'pls',
		name: 'Pillow Smash',
		description: 'Click the pillow as fast as you can for 5 seconds. Highest clicks wins.',
	},
	{
		id: 'tow',
		name: 'Tug of War',
		description: ''
	}
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
	def: MinigameDefinition;

	constructor(
		requestId: string, 
		gameScene: GameScene, 
		def: MinigameDefinition,
	) {
		this.requestId = requestId;
		this.gameScene = gameScene;
		this.def = def;
		this.setupSocketListeners();
	}

	setupSocketListeners() {
        this.gameScene.socket?.on('minigameInteracted', (requestId, data) => {
            if (this.requestId === requestId) {
                this.handleInteraction(data);
            }
        })
    }

	disconnectSocketListeners() {
        this.gameScene.socket?.off('minigameInteracted');
	}

	abstract handleInteraction(data: any): void;
	abstract getEndToastMessage(context: MinigameEndToastContext): string;
}

export abstract class SceneMinigame extends Minigame {
	minigameScene: MinigameScene;
	sceneContext: SceneMinigameContext;

	constructor(
		requestId: string, 
		gameScene: GameScene, 
		def: MinigameDefinition,
		sceneContext: SceneMinigameContext
	) {
		super(requestId, gameScene, def);
		this.sceneContext = sceneContext;
		const minigameSceneType = MINIGAME_SCENES[this.def.id];
		const MinigameSceneCtor = minigameSceneType as unknown as new (
			key: string,
			gameScene: GameScene,
			minigame: Minigame
		) => MinigameScene;
		this.minigameScene = new MinigameSceneCtor(this.def.id, this.gameScene, this);
	}
}

export abstract class ModalMinigame extends Minigame {
	abstract openMinigameModal(event: MinigameStartedEvent): void;
}