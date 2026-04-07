import { z } from 'zod';
export const setupVaultSchema = z.object({
    masterPassword: z.string().min(12),
    enableTrustedDeviceUnlock: z.boolean(),
});
export const unlockVaultSchema = z.object({
    masterPassword: z.string().min(12),
});
