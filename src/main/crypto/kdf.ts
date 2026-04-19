import { scryptSync } from 'node:crypto';

export type KdfParams = {
  algorithm: 'scrypt';
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
};

export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: 'scrypt',
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
};

export async function deriveMasterKey(input: {
  masterPassword: string;
  salt: Buffer;
  params?: KdfParams;
}): Promise<Buffer> {
  const params = input.params ?? DEFAULT_KDF_PARAMS;

  const derived = scryptSync(
    input.masterPassword,
    input.salt,
    params.keyLength,
    {
      N: params.cost,
      r: params.blockSize,
      p: params.parallelization,
    },
  );

  return Promise.resolve(Buffer.from(derived));
}
