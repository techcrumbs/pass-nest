export type BootstrapStatus =
  | { kind: 'needs-setup' }
  | { kind: 'locked'; trustedDeviceAvailable: boolean }
  | { kind: 'unlocked'; selectedProfileId: string | null };

export type SetupVaultInput = {
  masterPassword: string;
  enableTrustedDeviceUnlock: boolean;
};

export type UnlockVaultInput = {
  masterPassword: string;
};

export type VaultStatus =
  | { state: 'needs-setup' }
  | { state: 'locked' }
  | { state: 'unlocked' };
