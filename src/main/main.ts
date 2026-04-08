import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { initAppPaths } from './bootstrap/init-app';
import { VaultSession } from './crypto/vault-session';
import { openDatabase } from './db/client';
import { migrateDatabase } from './db/migrate';
import { EntriesRepository } from './db/repositories/entries-repository';
import { ProfilesRepository } from './db/repositories/profiles-repository';
import { VaultMetadataRepository } from './db/repositories/vault-metadata-repository';
import { registerAppHandlers } from './ipc/handlers/app';
import { registerEntryHandlers } from './ipc/handlers/entries';
import { registerProfileHandlers } from './ipc/handlers/profiles';
import { registerVaultHandlers } from './ipc/handlers/vault';
import { ClipboardService } from './platform/clipboard';
import { SafeStorageService } from './platform/safe-storage';
import { VaultService } from './services/vault-service';

let handlersRegistered = false;

function createWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1024,
    height: 780,
    minWidth: 900,
    minHeight: 700,
    title: 'PassNest',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
}

async function bootstrap(): Promise<void> {
  const paths = initAppPaths();
  const database = openDatabase(paths);
  migrateDatabase(database);

  const vaultSession = new VaultSession();
  const clipboardService = new ClipboardService();
  const safeStorageService = new SafeStorageService(paths.trustedDeviceSecretPath);
  const profilesRepository = new ProfilesRepository(database);
  const entriesRepository = new EntriesRepository(database);
  const vaultMetadataRepository = new VaultMetadataRepository(database);
  const vaultService = new VaultService(
    vaultMetadataRepository,
    vaultSession,
    safeStorageService,
  );

  vaultService.tryTrustedDeviceUnlock();

  if (!handlersRegistered) {
    registerAppHandlers(vaultService, clipboardService);
    registerVaultHandlers(vaultService);
    registerProfileHandlers(profilesRepository, vaultSession);
    registerEntryHandlers({
      entriesRepository,
      vaultSession,
      clipboardService,
    });
    handlersRegistered = true;
  }

  const mainWindow = createWindow();
  await mainWindow.loadFile(join(process.cwd(), 'src/renderer/index.html'));
}

app.whenReady().then(async () => {
  await bootstrap();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const mainWindow = createWindow();
      await mainWindow.loadFile(join(process.cwd(), 'src/renderer/index.html'));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
