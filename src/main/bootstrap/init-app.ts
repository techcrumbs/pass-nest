import { getAppPaths, ensureAppDirectories, type AppPaths } from './app-paths';

export function initAppPaths(): AppPaths {
  const paths = getAppPaths();
  ensureAppDirectories(paths);
  return paths;
}
