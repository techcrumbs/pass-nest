import type { EntryDto } from '../shared/dto/entries';
import type { ProfileDto } from '../shared/dto/profiles';
import type { BootstrapStatus } from '../shared/dto/vault';

type AppState = {
  bootstrapStatus: BootstrapStatus | null;
  profiles: ProfileDto[];
  entries: EntryDto[];
  selectedProfileId: string | null;
  message: string | null;
  error: string | null;
};

const rootElement = document.querySelector<HTMLDivElement>('#app');

if (!rootElement) {
  throw new Error('App root not found');
}

const root = rootElement;

const state: AppState = {
  bootstrapStatus: null,
  profiles: [],
  entries: [],
  selectedProfileId: null,
  message: null,
  error: null,
};

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    state.bootstrapStatus = await window.passNest.app.getBootstrapStatus();

    if (state.bootstrapStatus.kind === 'unlocked') {
      await loadUnlockedData();
    }
  } catch (error) {
    state.error = toMessage(error);
  }

  render();
}

async function loadUnlockedData(): Promise<void> {
  state.profiles = await window.passNest.profiles.list();
  const bootstrapSelectedProfileId =
    state.bootstrapStatus?.kind === 'unlocked'
      ? state.bootstrapStatus.selectedProfileId
      : null;

  state.selectedProfileId = state.selectedProfileId ?? bootstrapSelectedProfileId;

  if (
    state.selectedProfileId &&
    !state.profiles.some((profile) => profile.id === state.selectedProfileId)
  ) {
    state.selectedProfileId = null;
  }

  if (!state.selectedProfileId && state.profiles.length > 0) {
    state.selectedProfileId = state.profiles[0].id;
  }

  await loadEntries();
}

async function loadEntries(): Promise<void> {
  if (!state.selectedProfileId) {
    state.entries = [];
    return;
  }

  state.entries = await window.passNest.entries.listByProfile({
    profileId: state.selectedProfileId,
  });
}

function render(): void {
  if (!state.bootstrapStatus) {
    root.innerHTML = renderShell('<div class="card">Loading PassNest...</div>');
    return;
  }

  if (state.bootstrapStatus.kind === 'needs-setup') {
    root.innerHTML = renderShell(renderSetupScreen(), 'shell-auth');
    wireSetupScreen();
    return;
  }

  if (state.bootstrapStatus.kind === 'locked') {
    root.innerHTML = renderShell(renderLockedScreen(), 'shell-auth');
    wireLockedScreen();
    return;
  }

  root.innerHTML = renderShell(renderUnlockedScreen(), 'shell-unlocked');
  wireUnlockedScreen();
}

function renderShell(content: string, extraClass = ''): string {
  const banner = state.error
    ? `<div class="message error">${escapeHtml(state.error)}</div>`
    : state.message
      ? `<div class="message">${escapeHtml(state.message)}</div>`
      : '';

  return `
    <main class="shell ${extraClass}">
      <section class="hero">
        <div>
          <h1>PassNest</h1>
          <p>Local-first password storage with profiles, encrypted secrets, and copy-only access.</p>
        </div>
      </section>
      ${banner}
      ${content}
    </main>
  `;
}

function renderSetupScreen(): string {
  return `
    <section class="card setup-screen">
      <div class="stack">
        <h2>Create your vault</h2>
        <p>Your master password unlocks the vault key that protects saved entries. We never store raw passwords in SQLite.</p>
        <div class="message warning-callout">
          Copy or securely record your master password before continuing. If you lose it, PassNest cannot recover or reset it, and your saved passwords will remain inaccessible.
        </div>
        <form id="setup-form" class="stack">
          <label>
            Master password
            <input id="setup-master-password" name="masterPassword" type="password" minlength="12" required />
          </label>
          <label>
            Confirm master password
            <input id="setup-confirm-password" name="confirmPassword" type="password" minlength="12" required />
          </label>
          <label class="checkbox">
            <input id="setup-trusted-device" name="trustedDevice" type="checkbox" />
            Remember unlock on this device when secure storage supports it
          </label>
          <button type="submit">Create vault</button>
        </form>
      </div>
    </section>
  `;
}

function renderLockedScreen(): string {
  const note = state.bootstrapStatus?.kind === 'locked' &&
    state.bootstrapStatus.trustedDeviceAvailable
    ? '<p>Trusted-device unlock is supported on this system, but the vault is currently locked.</p>'
    : '<p>Enter your master password to unlock the vault.</p>';

  return `
    <section class="card locked-screen">
      <div class="stack">
        <h2>Unlock PassNest</h2>
        ${note}
        <form id="unlock-form" class="stack">
          <label>
            Master password
            <input id="unlock-master-password" name="masterPassword" type="password" minlength="12" required />
          </label>
          <button type="submit">Unlock</button>
        </form>
      </div>
    </section>
  `;
}

function renderUnlockedScreen(): string {
  const selectedProfile = state.profiles.find(
    (profile) => profile.id === state.selectedProfileId,
  );
  const profileOptions = state.profiles
    .map(
      (profile) => `
        <option value="${escapeHtml(profile.id)}" ${
          state.selectedProfileId === profile.id ? 'selected' : ''
        }>
          ${escapeHtml(profile.name)}
        </option>
      `,
    )
    .join('');

  const entriesMarkup =
    state.entries.length === 0
      ? '<div class="card empty">No passwords in the selected profile yet.</div>'
      : `
        <div class="list">
          ${state.entries
            .map(
              (entry) => `
                <article class="entry-row">
                  <div class="entry-meta">
                    <h3>${escapeHtml(entry.name)}</h3>
                    <div class="tags">
                      ${
                        entry.tags.length === 0
                          ? '<span class="tag">No tags</span>'
                          : entry.tags
                              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                              .join('')
                      }
                    </div>
                  </div>
                  <div class="row">
                    <button class="secondary" data-copy-entry-id="${escapeHtml(entry.id)}">Copy</button>
                    <button class="danger" data-delete-entry-id="${escapeHtml(entry.id)}">Delete</button>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      `;

  return `
    <section class="panel-grid">
      <aside class="panel stack">
        <div class="row spread">
          <h2>Profiles</h2>
          <button id="lock-vault-button" class="secondary" type="button">Lock</button>
        </div>
        <div class="stack">
          <label>
            Selected profile
            <select id="profile-select">
              ${
                state.profiles.length === 0
                  ? '<option value="">No profiles yet</option>'
                  : profileOptions
              }
            </select>
          </label>
          <form id="update-profile-form" class="stack">
            <label>
              Rename selected profile
              <input
                id="update-profile-name"
                name="name"
                type="text"
                maxlength="80"
                placeholder="Select a profile to rename"
                value="${selectedProfile ? escapeHtml(selectedProfile.name) : ''}"
                ${selectedProfile ? '' : 'disabled'}
                required
              />
            </label>
            <div class="row">
              <button type="submit" ${selectedProfile ? '' : 'disabled'}>Rename profile</button>
              <button id="delete-profile-button" class="danger" type="button" ${selectedProfile ? '' : 'disabled'}>Delete profile</button>
            </div>
          </form>
          <form id="create-profile-form" class="stack">
            <label>
              New profile
              <input id="create-profile-name" name="name" type="text" maxlength="80" placeholder="Personal, Work, Finance..." required />
            </label>
            <button type="submit">Create profile</button>
          </form>
        </div>
      </aside>

      <section class="stack">
        <section class="panel stack">
          <h2>Create password entry</h2>
          <form id="create-entry-form" class="stack">
            <label>
              Name
              <input id="create-entry-name" name="name" type="text" maxlength="120" placeholder="GitHub, Bank, Email..." required />
            </label>
            <label>
              Password value
              <input id="create-entry-password" name="password" type="password" required />
            </label>
            <label>
              Tags
              <input id="create-entry-tags" name="tags" type="text" placeholder="infra, personal, backup" />
            </label>
            <button type="submit" ${state.selectedProfileId ? '' : 'disabled'}>Save entry</button>
          </form>
        </section>

        <section class="stack">
          <div class="row spread">
            <h2>Passwords</h2>
            <p>${state.profiles.length} profile(s), ${state.entries.length} visible entry(ies)</p>
          </div>
          ${
            state.profiles.length === 0
              ? '<div class="card empty">Create your first profile to start saving passwords.</div>'
              : entriesMarkup
          }
        </section>
      </section>
    </section>
  `;
}

function wireSetupScreen(): void {
  const form = document.querySelector<HTMLFormElement>('#setup-form');
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const masterPassword = getRawInputValue('#setup-master-password');
    const confirmPassword = getRawInputValue('#setup-confirm-password');
    const enableTrustedDeviceUnlock =
      getCheckboxValue('#setup-trusted-device');

    if (masterPassword !== confirmPassword) {
      setError('Master password confirmation does not match.');
      render();
      return;
    }

    try {
      clearMessages();
      await window.passNest.vault.setup({
        masterPassword,
        enableTrustedDeviceUnlock,
      });
      state.bootstrapStatus = {
        kind: 'unlocked',
        selectedProfileId: null,
      };
      await loadUnlockedData();
      setMessage('Vault created successfully.');
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });
}

function wireLockedScreen(): void {
  const form = document.querySelector<HTMLFormElement>('#unlock-form');
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      clearMessages();
      await window.passNest.vault.unlock({
        masterPassword: getRawInputValue('#unlock-master-password'),
      });
      state.bootstrapStatus = {
        kind: 'unlocked',
        selectedProfileId: state.selectedProfileId,
      };
      await loadUnlockedData();
      setMessage('Vault unlocked.');
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });
}

function wireUnlockedScreen(): void {
  const createProfileForm =
    document.querySelector<HTMLFormElement>('#create-profile-form');
  const updateProfileForm =
    document.querySelector<HTMLFormElement>('#update-profile-form');
  const createEntryForm =
    document.querySelector<HTMLFormElement>('#create-entry-form');
  const profileSelect = document.querySelector<HTMLSelectElement>('#profile-select');
  const lockButton = document.querySelector<HTMLButtonElement>('#lock-vault-button');
  const deleteProfileButton =
    document.querySelector<HTMLButtonElement>('#delete-profile-button');

  createProfileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      clearMessages();
      const profile = await window.passNest.profiles.create({
        name: getInputValue('#create-profile-name'),
      });
      state.profiles = await window.passNest.profiles.list();
      state.selectedProfileId = state.selectedProfileId ?? profile.id;
      await loadEntries();
      createProfileForm.reset();
      setMessage(`Profile "${profile.name}" created.`);
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });

  createEntryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.selectedProfileId) {
      setError('Create or select a profile first.');
      render();
      return;
    }

    try {
      clearMessages();
      const tags = getInputValue('#create-entry-tags')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index);

      const entry = await window.passNest.entries.create({
        profileId: state.selectedProfileId,
        name: getInputValue('#create-entry-name'),
        password: getRawInputValue('#create-entry-password'),
        tags,
      });
      await loadEntries();
      createEntryForm.reset();
      setMessage(`Saved "${entry.name}".`);
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });

  updateProfileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.selectedProfileId) {
      setError('Select a profile to rename.');
      render();
      return;
    }

    try {
      clearMessages();
      const profile = await window.passNest.profiles.update({
        id: state.selectedProfileId,
        name: getInputValue('#update-profile-name'),
      });
      await refreshProfilesAndSelection(profile.id);
      setMessage(`Profile renamed to "${profile.name}".`);
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });

  profileSelect?.addEventListener('change', async (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    state.selectedProfileId = select.value || null;
    await loadEntries();
    render();
  });

  deleteProfileButton?.addEventListener('click', async () => {
    if (!state.selectedProfileId) {
      return;
    }

    const selectedProfile = state.profiles.find(
      (profile) => profile.id === state.selectedProfileId,
    );

    if (
      !window.confirm(
        `Delete profile "${selectedProfile?.name ?? 'selected profile'}" and all passwords in it?`,
      )
    ) {
      return;
    }

    const deletingProfileId = state.selectedProfileId;

    try {
      clearMessages();
      await window.passNest.profiles.delete({ id: deletingProfileId });
      await refreshProfilesAndSelection();
      setMessage('Profile deleted.');
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });

  lockButton?.addEventListener('click', async () => {
    try {
      clearMessages();
      await window.passNest.vault.lock();
      state.bootstrapStatus = await window.passNest.app.getBootstrapStatus();
      state.entries = [];
      setMessage('Vault locked.');
    } catch (error) {
      setError(toMessage(error));
    }

    render();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-entry-id]')) {
    button.addEventListener('click', async () => {
      const id = button.dataset.copyEntryId;
      if (!id) {
        return;
      }

      try {
        clearMessages();
        await window.passNest.entries.copyPassword({ id });
        setMessage('Password copied to clipboard.');
      } catch (error) {
        setError(toMessage(error));
      }

      render();
    });
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-delete-entry-id]')) {
    button.addEventListener('click', async () => {
      const id = button.dataset.deleteEntryId;
      if (!id) {
        return;
      }

      if (!window.confirm('Delete this password entry?')) {
        return;
      }

      try {
        clearMessages();
        await window.passNest.entries.delete({ id });
        await loadEntries();
        setMessage('Password entry deleted.');
      } catch (error) {
        setError(toMessage(error));
      }

      render();
    });
  }
}

function setMessage(message: string): void {
  state.message = message;
  state.error = null;
}

function setError(message: string): void {
  state.error = message;
  state.message = null;
}

function clearMessages(): void {
  state.message = null;
  state.error = null;
}

async function refreshProfilesAndSelection(preferredProfileId?: string): Promise<void> {
  state.profiles = await window.passNest.profiles.list();

  if (
    preferredProfileId &&
    state.profiles.some((profile) => profile.id === preferredProfileId)
  ) {
    state.selectedProfileId = preferredProfileId;
  } else if (
    state.selectedProfileId &&
    state.profiles.some((profile) => profile.id === state.selectedProfileId)
  ) {
    // keep the current selection if it still exists
  } else {
    state.selectedProfileId = state.profiles[0]?.id ?? null;
  }

  await loadEntries();
}

function getInputValue(selector: string): string {
  const input = document.querySelector<HTMLInputElement>(selector);
  return input?.value.trim() ?? '';
}

function getRawInputValue(selector: string): string {
  const input = document.querySelector<HTMLInputElement>(selector);
  return input?.value ?? '';
}

function getCheckboxValue(selector: string): boolean {
  const input = document.querySelector<HTMLInputElement>(selector);
  return input?.checked ?? false;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
