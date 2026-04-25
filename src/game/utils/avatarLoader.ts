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

export async function preloadAvatarTextures(scene: Phaser.Scene): Promise<void> {
  const avatars = getAvatarAssets();
  console.log("preloading avatars:", avatars.length);
  
  const loadPromises = avatars.map(({ key, url }) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
            scene.textures.addImage(key, img);
        } catch (e) {
          console.error(`Failed to create texture for ${key}:`, e);
        }
        resolve();
      };
      
      img.onerror = () => {
        console.error(`Failed to load image: ${key} from ${url}`);
        resolve();
      };
      
      img.src = url;
    });
  });
  
  await Promise.all(loadPromises);
}
