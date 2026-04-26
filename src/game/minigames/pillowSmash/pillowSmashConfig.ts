export type MinigameUiConfig = {
    pillText: string;
    instructions: string;
    waitingLabel: string;
};

const DEFAULT_CONFIG: MinigameUiConfig = {
    pillText: 'Minigame Live',
    instructions: 'Tap as fast as you can for 5 seconds. Highest taps wins the showdown.',
    waitingLabel: 'Waiting For Opponent...',
};

const PILLOW_SMASH_CONFIG: MinigameUiConfig = {
    pillText: 'Pillow Smash Live',
    instructions: 'Click the pillow as fast as you can for 5 seconds. Whoever gets the most clicks wins.',
    waitingLabel: 'Waiting For Opponent...',
};

export function getMinigameUiConfig(minigameId: string): MinigameUiConfig {
    if (minigameId === 'pillow-smash') {
        return PILLOW_SMASH_CONFIG;
    }

    return DEFAULT_CONFIG;
}
