import * as Phaser from 'phaser';

// Dynamically import all avatar images from the avatars directory
const avatarModules = import.meta.glob<{ default: string }>(
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
 * File names will be converted to keys (e.g., meme1.png -> meme1)
 */
export function getAvatarAssets(): AvatarAsset[] {
  return Object.entries(avatarModules).map(([path, moduleData]) => {
    const filename = path.split('/').pop() || '';
    const key = filename.replace(/\.[^/.]+$/, ''); // Remove file extension
    // Extract the actual URL from the module - it should be the default export
    const url = typeof moduleData === 'string' ? moduleData : (moduleData.default || moduleData);
    return { key, url };
  });
}

/**
 * Preloads all avatar textures into a Phaser scene
 * Creates canvas textures from loaded images to work properly with Vite
 * Resizes all avatars to 160x160
 */
export async function preloadAvatarTextures(scene: Phaser.Scene, size = 160): Promise<void> {
  const avatars = getAvatarAssets();
  console.log("preloading avatars:", avatars.length);
  
  const loadPromises = avatars.map(({ key, url }) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Create a canvas at the target size
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw the image scaled to fill the canvas
            ctx.drawImage(img, 0, 0, size, size);
            
            // Add the canvas as a texture using Phaser's internal method
            scene.textures.addCanvas(key, canvas);
            console.log(`✓ avatar ${key} loaded and registered (resized to ${size}x${size})`);
          }
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
