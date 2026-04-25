import * as Phaser from 'phaser';

// Dynamically import all avatar
const avatarModules = import.meta.glob<{ default: string }>(
  '../../assets/avatar/**/*.{png,jpg,jpeg,gif,svg}',
  { eager: true, import: 'default' }
);

export interface AvatarAsset {
  key: string;
  url: string;
}

export function getAvatarAssets(): AvatarAsset[] {
  return Object.entries(avatarModules).map(([path, moduleData]) => {
    const filename = path.split('/').pop() || '';
    const key = filename.replace(/\.[^/.]+$/, ''); // Remove file extension
    const url = String(moduleData);
    return { key, url };
  });
}

export function preloadAvatarTextures(scene: Phaser.Scene): void {
  const avatars = getAvatarAssets();
  console.log('Queueing avatar textures:', avatars.length);

  for (const { key, url } of avatars) {
    scene.load.image(key, url);
  }
}
