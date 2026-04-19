import { clipboard } from 'electron';

export class ClipboardService {
  writeText(value: string): void {
    clipboard.writeText(value);
  }
}
