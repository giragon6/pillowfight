export type MinigameDefinition = {
	id: string;
	name: string;
	description: string;
};

export const SLEEPOVER_MINIGAMES: MinigameDefinition[] = [
	{
		id: 'pillow-duel',
		name: 'Pillow Duel',
		description: 'Best two out of three pillow swings wins the wager.',
	},
	{
		id: 'flashlight-tag',
		name: 'Flashlight Tag',
		description: 'Catch your rival in the beam before they hide.',
	},
	{
		id: 'snack-sprint',
		name: 'Snack Sprint',
		description: 'Race to gather midnight snacks before the timer ends.',
	},
	{
		id: 'blanket-fort',
		name: 'Blanket Fort Build-Off',
		description: 'Build the strongest fort under pressure.',
	},
];

export function pickRandomMinigame(): MinigameDefinition {
	const randomIndex = Math.floor(Math.random() * SLEEPOVER_MINIGAMES.length);
	return SLEEPOVER_MINIGAMES[randomIndex];
}
