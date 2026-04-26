import * as Phaser from 'phaser';
import { GameScene } from './GameScene';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/events';

let gameInstance: Phaser.Game | null = null;
let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let gameScene: GameScene | null = null;
let exitHandlersAttached = false;
const socketServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

function attachExitHandlers() {
  if (exitHandlersAttached) return;

  const disconnectPlayer = () => {
    if (!socketInstance) return;

    // Avoid reconnect loops while page is closing.
    socketInstance.io.opts.reconnection = false;
    if (socketInstance.connected) {
      socketInstance.disconnect();
    }
  };

  window.addEventListener('beforeunload', disconnectPlayer);
  window.addEventListener('pagehide', disconnectPlayer);
  exitHandlersAttached = true;
}

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
    socketInstance = io(socketServerUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    attachExitHandlers();
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
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameInstance = new Phaser.Game(config);

    // Initialize the game scene with socket after game is created
    gameScene.initialize(socketInstance);
  }

  return { game: gameInstance, socket: socketInstance };
}
