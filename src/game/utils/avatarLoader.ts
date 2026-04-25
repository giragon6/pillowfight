import * as Phaser from 'phaser';

// Dynamically import all avatar images from the avatars directory
const avatarModules = import.meta.glob<string>(
  '../../assets/avatars/**/*.{png,jpg,jpeg,gif,svg}',
  { eager: true, import: 'default' }
);

export interface AvatarAsset {
  key: string;
  url: string;
}

/**
 * Gets all available avatar assets
 * Expects avatar files to be in src/assets/avatars/
 * File names will be converted to keys (e.g., avatar1.png -> avatar1)
 */
export function getAvatarAssets(): AvatarAsset[] {
  return Object.entries(avatarModules).map(([path, url]) => {
    // Extract filename from path: ../avatars/avatar1.png -> avatar1
    const filename = path.split('/').pop() || '';
    const key = filename.replace(/\.[^/.]+$/, ''); // Remove file extension
    return { key, url };
  });
}

/**
 * Preloads all avatar textures into a Phaser scene
 */
export function preloadAvatarTextures(scene: Phaser.Scene): void {
  const avatars = getAvatarAssets();
  avatars.forEach(({ key, url }) => {
    scene.load.image(key, url);
  });
}
