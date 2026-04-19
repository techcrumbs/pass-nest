import type {
  EntryDto,
  CreateEntryInput,
  UpdateEntryInput,
} from '../shared/dto/entries';
import type {
  ProfileDto,
  CreateProfileInput,
  UpdateProfileInput,
} from '../shared/dto/profiles';
import type {
  BootstrapStatus,
  SetupVaultInput,
  UnlockVaultInput,
  VaultStatus,
} from '../shared/dto/vault';

export type PassNestApi = {
  app: {
    getBootstrapStatus(): Promise<BootstrapStatus>;
    copyText(input: { value: string }): Promise<{ ok: true }>;
  };
  vault: {
    setup(input: SetupVaultInput): Promise<{ ok: true }>;
    unlock(input: UnlockVaultInput): Promise<{ ok: true }>;
    lock(): Promise<{ ok: true }>;
    getStatus(): Promise<VaultStatus>;
    setTrustedDeviceUnlock(input: {
      enableTrustedDeviceUnlock: boolean;
    }): Promise<{ ok: true }>;
  };
  profiles: {
    list(): Promise<ProfileDto[]>;
    create(input: CreateProfileInput): Promise<ProfileDto>;
    update(input: UpdateProfileInput): Promise<ProfileDto>;
    delete(input: { id: string }): Promise<{ ok: true }>;
  };
  entries: {
    listByProfile(input: { profileId: string }): Promise<EntryDto[]>;
    create(input: CreateEntryInput): Promise<EntryDto>;
    update(input: UpdateEntryInput): Promise<EntryDto>;
    delete(input: { id: string }): Promise<{ ok: true }>;
    copyPassword(input: { id: string }): Promise<{ ok: true }>;
  };
};
