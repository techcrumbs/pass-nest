import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../channels';
import type { VaultService } from '../../services/vault-service';
import { setupVaultSchema, unlockVaultSchema } from '../../../shared/validation/vault';

export function registerVaultHandlers(vaultService: VaultService): void {
  ipcMain.handle(IPC_CHANNELS.vaultSetup, async (_event, input: unknown) => {
    return vaultService.setupVault(setupVaultSchema.parse(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultUnlock, async (_event, input: unknown) => {
    return vaultService.unlockVault(unlockVaultSchema.parse(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultLock, async () => {
    return vaultService.lockVault();
  });

  ipcMain.handle(IPC_CHANNELS.vaultGetStatus, async () => {
    return vaultService.getVaultStatus();
  });

  ipcMain.handle(
    IPC_CHANNELS.vaultSetTrustedDeviceUnlock,
    async (_event, input: unknown) => {
      const parsed = setupVaultSchema.pick({
        enableTrustedDeviceUnlock: true,
      }).parse(input);

      return vaultService.setTrustedDeviceUnlock(
        parsed.enableTrustedDeviceUnlock,
      );
    },
  );
}
