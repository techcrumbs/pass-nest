import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AppPaths = {
  rootDir: string;
  databasePath: string;
  trustedDeviceSecretPath: string;
};

export function getAppPaths(): AppPaths {
  const rootDir = join(homedir(), '.config', 'passnest-desktop');

  return {
    rootDir,
    databasePath: join(rootDir, 'passnest.db'),
    trustedDeviceSecretPath: join(rootDir, 'trusted-device-secret.bin'),
  };
}

export function ensureAppDirectories(paths: AppPaths): void {
  mkdirSync(paths.rootDir, { recursive: true });
}
