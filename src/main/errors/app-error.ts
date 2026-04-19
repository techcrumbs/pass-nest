export class AppError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_PASSWORD'
      | 'VAULT_LOCKED'
      | 'ENTRY_NOT_FOUND'
      | 'PROFILE_NOT_FOUND'
      | 'DUPLICATE_PROFILE_NAME'
      | 'TRUSTED_DEVICE_UNAVAILABLE'
      | 'VALIDATION_ERROR'
      | 'VAULT_ALREADY_EXISTS',
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
