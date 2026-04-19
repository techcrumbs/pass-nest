import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../channels';
import type { VaultService } from '../../services/vault-service';
import type { ClipboardService } from '../../platform/clipboard';

export function registerAppHandlers(
  vaultService: VaultService,
  clipboardService: ClipboardService,
): void {
  ipcMain.handle(IPC_CHANNELS.appGetBootstrapStatus, async () =>
    vaultService.getBootstrapStatus(),
  );

  ipcMain.handle(IPC_CHANNELS.appCopyText, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      !('value' in input) ||
      typeof (input as { value: unknown }).value !== 'string'
    ) {
      throw new Error('Invalid copy input.');
    }

    clipboardService.writeText((input as { value: string }).value);
    return { ok: true as const };
  });
}
