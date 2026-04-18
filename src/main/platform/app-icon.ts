import { existsSync } from 'node:fs';
import { nativeImage, type NativeImage } from 'electron';
import { getProjectAssetPath } from './runtime-paths';

const ICON_CANDIDATES = [
  getProjectAssetPath('src/renderer/assets/passnest-icon.png'),
  getProjectAssetPath('src/renderer/assets/passnest-icon.svg'),
  getProjectAssetPath('dist-renderer/renderer/assets/passnest-icon.png'),
  getProjectAssetPath('dist-renderer/renderer/assets/passnest-icon.svg'),
];

export function getAppIconPath(): string | null {
  for (const candidate of ICON_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getAppIcon(): NativeImage | null {
  for (const candidate of ICON_CANDIDATES) {
    if (!existsSync(candidate)) {
      continue;
    }

    const icon = nativeImage.createFromPath(candidate);

    if (!icon.isEmpty()) {
      return icon;
    }
  }

  return null;
}
