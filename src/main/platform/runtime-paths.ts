import { app } from 'electron';
import { join } from 'node:path';

function getProjectRootPath(): string {
  return app.isPackaged ? app.getAppPath() : process.cwd();
}

export function getRendererHtmlPath(): string {
  return join(getProjectRootPath(), 'src/renderer/index.html');
}

export function getPreloadScriptPath(): string {
  return join(getProjectRootPath(), 'dist/preload/index.js');
}

export function getProjectAssetPath(...segments: string[]): string {
  return join(getProjectRootPath(), ...segments);
}
