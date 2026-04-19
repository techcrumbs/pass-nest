import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const VAULT_KEY_LENGTH = 32;
const IV_LENGTH = 12;

export type WrappedPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function generateVaultKey(): Buffer {
  return randomBytes(VAULT_KEY_LENGTH);
}

export function generateSalt(length = 16): Buffer {
  return randomBytes(length);
}

export function encryptWithKey(input: {
  key: Buffer;
  plaintext: Buffer | string;
}): WrappedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, input.key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

export function decryptWithKey(input: {
  key: Buffer;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}): Buffer {
  const decipher = createDecipheriv(AES_ALGORITHM, input.key, input.iv);
  decipher.setAuthTag(input.authTag);

  return Buffer.concat([
    decipher.update(input.ciphertext),
    decipher.final(),
  ]);
}

export function wrapVaultKey(input: {
  masterDerivedKey: Buffer;
  vaultKey: Buffer;
}): WrappedPayload {
  return encryptWithKey({
    key: input.masterDerivedKey,
    plaintext: input.vaultKey,
  });
}

export function unwrapVaultKey(input: {
  masterDerivedKey: Buffer;
  wrappedVaultKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
}): Buffer {
  return decryptWithKey({
    key: input.masterDerivedKey,
    ciphertext: input.wrappedVaultKey,
    iv: input.iv,
    authTag: input.authTag,
  });
}

export function encryptEntryPassword(input: {
  vaultKey: Buffer;
  password: string;
}): WrappedPayload {
  return encryptWithKey({
    key: input.vaultKey,
    plaintext: Buffer.from(input.password, 'utf8'),
  });
}

export function decryptEntryPassword(input: {
  vaultKey: Buffer;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}): string {
  return decryptWithKey({
    key: input.vaultKey,
    ciphertext: input.ciphertext,
    iv: input.iv,
    authTag: input.authTag,
  }).toString('utf8');
}
