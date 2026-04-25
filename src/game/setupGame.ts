import * as Phaser from 'phaser';
import { GameScene } from './GameScene';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events';

let gameInstance: Phaser.Game | null = null;
let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let gameScene: GameScene | null = null;

export function setupGame(): {
  game: Phaser.Game;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
} {
  // Hide the React app
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.style.display = 'none';
  }

  // Create socket connection if it doesn't exist
  if (!socketInstance) {
    socketInstance = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
  }

  // Create Phaser game instance if it doesn't exist
  if (!gameInstance) {
    // Create GameScene instance
    gameScene = new GameScene();

    const width = window.innerWidth;
    const height = window.innerHeight;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: width,
      height: height,
      parent: 'game-container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [gameScene],
      render: {
        pixelArt: true,
        antialias: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameInstance = new Phaser.Game(config);

    // Initialize the game scene with socket after game is created
    gameScene.initialize(socketInstance);
  }

  return { game: gameInstance, socket: socketInstance };
}
