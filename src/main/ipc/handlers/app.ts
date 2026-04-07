import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../channels';
import type { VaultService } from '../../services/vault-service';

export function registerAppHandlers(vaultService: VaultService): void {
  ipcMain.handle(IPC_CHANNELS.appGetBootstrapStatus, async () =>
    vaultService.getBootstrapStatus(),
  );
}
