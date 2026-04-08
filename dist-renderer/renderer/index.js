const rootElement = document.querySelector('#app');
if (!rootElement) {
    throw new Error('App root not found');
}
const root = rootElement;
const state = {
    bootstrapStatus: null,
    profiles: [],
    entries: [],
    selectedProfileId: null,
    suggestedMasterPassword: '',
    showCreateProfileForm: false,
    showCreateEntryForm: false,
    editingEntryId: null,
    message: null,
    error: null,
};
void bootstrap();
async function bootstrap() {
    try {
        state.bootstrapStatus = await window.passNest.app.getBootstrapStatus();
        if (state.bootstrapStatus.kind === 'unlocked') {
            await loadUnlockedData();
        }
    }
    catch (error) {
        state.error = toMessage(error);
    }
    render();
}
async function loadUnlockedData() {
    state.profiles = await window.passNest.profiles.list();
    const bootstrapSelectedProfileId = state.bootstrapStatus?.kind === 'unlocked'
        ? state.bootstrapStatus.selectedProfileId
        : null;
    state.selectedProfileId = state.selectedProfileId ?? bootstrapSelectedProfileId;
    if (state.selectedProfileId &&
        !state.profiles.some((profile) => profile.id === state.selectedProfileId)) {
        state.selectedProfileId = null;
    }
    if (!state.selectedProfileId && state.profiles.length > 0) {
        state.selectedProfileId = state.profiles[0].id;
    }
    await loadEntries();
}
async function loadEntries() {
    if (!state.selectedProfileId) {
        state.entries = [];
        return;
    }
    const entries = await window.passNest.entries.listByProfile({
        profileId: state.selectedProfileId,
    });
    state.entries = entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'accent' }));
}
function render() {
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
function renderShell(content, extraClass = '') {
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
function renderSetupScreen() {
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
            <input
              id="setup-master-password"
              name="masterPassword"
              type="password"
              minlength="12"
              value="${escapeHtml(state.suggestedMasterPassword)}"
              required
            />
          </label>
          <label>
            Confirm master password
            <input
              id="setup-confirm-password"
              name="confirmPassword"
              type="password"
              minlength="12"
              value="${escapeHtml(state.suggestedMasterPassword)}"
              required
            />
          </label>
          <div class="row form-actions">
            <button id="suggest-master-password-button" class="secondary" type="button">
              Suggest and copy master password
            </button>
          </div>
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
function renderLockedScreen() {
    const note = state.bootstrapStatus?.kind === 'locked' &&
        state.bootstrapStatus.trustedDeviceAvailable
        ? '<p>This device supports secure local unlock. Enter your master password to open the vault.</p>'
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
function renderUnlockedScreen() {
    if (state.profiles.length === 0) {
        return `
      <section class="card first-profile-screen">
        <div class="row spread">
          <h2>Create your first profile</h2>
          <button id="lock-vault-button" class="secondary" type="button">Lock</button>
        </div>
        <div class="stack">
          <p>
            Profiles help you group passwords logically. Start by creating one profile,
            then you can begin saving password entries inside it.
          </p>
          <form id="create-profile-form" class="stack">
            <label>
              Profile name
              <input
                id="create-profile-name"
                name="name"
                type="text"
                maxlength="80"
                placeholder="Personal, Work, Finance..."
                required
              />
            </label>
            <button type="submit">Create profile</button>
          </form>
        </div>
      </section>
    `;
    }
    const selectedProfile = state.profiles.find((profile) => profile.id === state.selectedProfileId);
    const editingEntry = state.entries.find((entry) => entry.id === state.editingEntryId) ?? null;
    const profileOptions = state.profiles
        .map((profile) => `
        <option value="${escapeHtml(profile.id)}" ${state.selectedProfileId === profile.id ? 'selected' : ''}>
          ${escapeHtml(profile.name)}
        </option>
      `)
        .join('');
    const entriesMarkup = state.entries.length === 0
        ? '<div class="card empty">No passwords in the selected profile yet.</div>'
        : `
        <div class="list">
          ${state.entries
            .map((entry) => `
                <article class="entry-row">
                  <div class="entry-meta">
                    <h3>${escapeHtml(entry.name)}</h3>
                    <div class="tags">
                      ${entry.tags.length === 0
            ? '<span class="tag">No tags</span>'
            : entry.tags
                .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                .join('')}
                    </div>
                  </div>
                  <div class="row">
                    <button class="secondary" data-edit-entry-id="${escapeHtml(entry.id)}">Edit</button>
                    <button class="secondary" data-copy-entry-id="${escapeHtml(entry.id)}">Copy</button>
                    <button class="danger" data-delete-entry-id="${escapeHtml(entry.id)}">Delete</button>
                  </div>
                </article>
              `)
            .join('')}
        </div>
      `;
    const createProfileMarkup = state.showCreateProfileForm
        ? `
      <section class="panel stack inline-form-panel">
        <div class="row spread">
          <h2>Create profile</h2>
          <button id="cancel-create-profile-button" class="secondary" type="button">Close</button>
        </div>
        <form id="create-profile-form" class="stack">
          <label>
            Profile name
            <input id="create-profile-name" name="name" type="text" maxlength="80" placeholder="Personal, Work, Finance..." required />
          </label>
          <button type="submit">Create profile</button>
        </form>
      </section>
    `
        : '';
    const createEntryMarkup = state.showCreateEntryForm
        ? `
      <section class="panel stack inline-form-panel">
        <div class="row spread">
          <h2>Create password entry</h2>
          <button id="cancel-create-entry-button" class="secondary" type="button">Close</button>
        </div>
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
          <button type="submit">Save entry</button>
        </form>
      </section>
    `
        : '';
    const editEntryMarkup = editingEntry
        ? `
      <section class="panel stack inline-form-panel">
        <div class="row spread">
          <h2>Edit password entry</h2>
          <button id="cancel-edit-entry-button" class="secondary" type="button">Close</button>
        </div>
        <form id="edit-entry-form" class="stack">
          <label>
            Name
            <input
              id="edit-entry-name"
              name="name"
              type="text"
              maxlength="120"
              value="${escapeHtml(editingEntry.name)}"
              required
            />
          </label>
          <label>
            New password value
            <input
              id="edit-entry-password"
              name="password"
              type="password"
              placeholder="Leave blank to keep the existing password"
            />
          </label>
          <label>
            Tags
            <input
              id="edit-entry-tags"
              name="tags"
              type="text"
              value="${escapeHtml(editingEntry.tags.join(', '))}"
              placeholder="infra, personal, backup"
            />
          </label>
          <button type="submit">Save changes</button>
        </form>
      </section>
    `
        : '';
    return `
    <section class="stack workspace-stack">
      <section class="panel toolbar-panel">
        <div class="row spread">
          <div class="toolbar-profile">
            <label>
              Profile
              <select id="profile-select">
                ${profileOptions}
              </select>
              <span class="toolbar-hint">
                ${selectedProfile ? `${escapeHtml(selectedProfile.name)} selected` : 'No profile selected'}
              </span>
            </label>
          </div>
          <div class="row toolbar-actions">
            <button id="show-create-profile-button" class="secondary" type="button">New profile</button>
            <button id="show-create-entry-button" type="button">Add password</button>
            <button id="lock-vault-button" class="secondary" type="button">Lock</button>
          </div>
        </div>
      </section>

      ${createProfileMarkup}
      ${createEntryMarkup}
      ${editEntryMarkup}

      <section class="stack password-list-shell">
        <section class="stack password-list-section">
          <div class="row spread">
            <h2>Passwords</h2>
            <p>${state.entries.length} visible entry(ies)</p>
          </div>
          ${entriesMarkup}
        </section>
      </section>
    </section>
  `;
}
function wireSetupScreen() {
    const form = document.querySelector('#setup-form');
    const suggestMasterPasswordButton = document.querySelector('#suggest-master-password-button');
    if (!form) {
        return;
    }
    suggestMasterPasswordButton?.addEventListener('click', () => {
        const masterPasswordInput = document.querySelector('#setup-master-password');
        const confirmPasswordInput = document.querySelector('#setup-confirm-password');
        if (!masterPasswordInput || !confirmPasswordInput) {
            return;
        }
        const suggestedPassword = generateSuggestedPassword(24);
        state.suggestedMasterPassword = suggestedPassword;
        masterPasswordInput.value = suggestedPassword;
        confirmPasswordInput.value = suggestedPassword;
        void window.passNest.app.copyText({ value: suggestedPassword });
        setMessage('Suggested master password copied to clipboard.');
        render();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const masterPassword = getRawInputValue('#setup-master-password');
        const confirmPassword = getRawInputValue('#setup-confirm-password');
        const enableTrustedDeviceUnlock = getCheckboxValue('#setup-trusted-device');
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
            state.suggestedMasterPassword = '';
            state.bootstrapStatus = {
                kind: 'unlocked',
                selectedProfileId: null,
            };
            await loadUnlockedData();
            setMessage('Vault created successfully.');
        }
        catch (error) {
            setError(toMessage(error));
        }
        render();
    });
}
function wireLockedScreen() {
    const form = document.querySelector('#unlock-form');
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
        }
        catch (error) {
            setError(toMessage(error));
        }
        render();
    });
}
function wireUnlockedScreen() {
    const createProfileForm = document.querySelector('#create-profile-form');
    const createEntryForm = document.querySelector('#create-entry-form');
    const editEntryForm = document.querySelector('#edit-entry-form');
    const profileSelect = document.querySelector('#profile-select');
    const lockButton = document.querySelector('#lock-vault-button');
    const showCreateProfileButton = document.querySelector('#show-create-profile-button');
    const cancelCreateProfileButton = document.querySelector('#cancel-create-profile-button');
    const showCreateEntryButton = document.querySelector('#show-create-entry-button');
    const cancelCreateEntryButton = document.querySelector('#cancel-create-entry-button');
    const cancelEditEntryButton = document.querySelector('#cancel-edit-entry-button');
    createProfileForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            clearMessages();
            const profile = await window.passNest.profiles.create({
                name: getInputValue('#create-profile-name'),
            });
            state.showCreateProfileForm = false;
            await refreshProfilesAndSelection(profile.id);
            createProfileForm.reset();
            setMessage(`Profile "${profile.name}" created.`);
        }
        catch (error) {
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
            state.showCreateEntryForm = false;
            await loadEntries();
            createEntryForm.reset();
            setMessage(`Saved "${entry.name}".`);
        }
        catch (error) {
            setError(toMessage(error));
        }
        render();
    });
    editEntryForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const editingEntry = state.entries.find((entry) => entry.id === state.editingEntryId);
        if (!editingEntry) {
            setError('Select an entry to edit.');
            render();
            return;
        }
        try {
            clearMessages();
            const tags = getInputValue('#edit-entry-tags')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
                .filter((value, index, values) => values.indexOf(value) === index);
            const nextPassword = getRawInputValue('#edit-entry-password');
            const entry = await window.passNest.entries.update({
                id: editingEntry.id,
                profileId: editingEntry.profileId,
                name: getInputValue('#edit-entry-name'),
                ...(nextPassword ? { password: nextPassword } : {}),
                tags,
            });
            state.editingEntryId = null;
            await loadEntries();
            setMessage(`Updated "${entry.name}".`);
        }
        catch (error) {
            setError(toMessage(error));
        }
        render();
    });
    profileSelect?.addEventListener('change', async (event) => {
        const select = event.currentTarget;
        state.selectedProfileId = select.value || null;
        await loadEntries();
        render();
    });
    showCreateProfileButton?.addEventListener('click', () => {
        clearMessages();
        state.showCreateProfileForm = true;
        state.showCreateEntryForm = false;
        state.editingEntryId = null;
        render();
    });
    cancelCreateProfileButton?.addEventListener('click', () => {
        state.showCreateProfileForm = false;
        render();
    });
    showCreateEntryButton?.addEventListener('click', () => {
        clearMessages();
        state.showCreateEntryForm = true;
        state.showCreateProfileForm = false;
        state.editingEntryId = null;
        render();
    });
    cancelCreateEntryButton?.addEventListener('click', () => {
        state.showCreateEntryForm = false;
        render();
    });
    cancelEditEntryButton?.addEventListener('click', () => {
        state.editingEntryId = null;
        render();
    });
    lockButton?.addEventListener('click', async () => {
        try {
            clearMessages();
            await window.passNest.vault.lock();
            state.bootstrapStatus = await window.passNest.app.getBootstrapStatus();
            state.entries = [];
            state.showCreateEntryForm = false;
            state.showCreateProfileForm = false;
            state.editingEntryId = null;
            setMessage('Vault locked.');
        }
        catch (error) {
            setError(toMessage(error));
        }
        render();
    });
    for (const button of document.querySelectorAll('[data-copy-entry-id]')) {
        button.addEventListener('click', async () => {
            const id = button.dataset.copyEntryId;
            if (!id) {
                return;
            }
            try {
                clearMessages();
                await window.passNest.entries.copyPassword({ id });
                setMessage('Password copied to clipboard.');
            }
            catch (error) {
                setError(toMessage(error));
            }
            render();
        });
    }
    for (const button of document.querySelectorAll('[data-edit-entry-id]')) {
        button.addEventListener('click', () => {
            const id = button.dataset.editEntryId;
            if (!id) {
                return;
            }
            clearMessages();
            state.editingEntryId = id;
            state.showCreateEntryForm = false;
            state.showCreateProfileForm = false;
            render();
        });
    }
    for (const button of document.querySelectorAll('[data-delete-entry-id]')) {
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
            }
            catch (error) {
                setError(toMessage(error));
            }
            render();
        });
    }
}
function setMessage(message) {
    state.message = message;
    state.error = null;
}
function setError(message) {
    state.error = message;
    state.message = null;
}
function clearMessages() {
    state.message = null;
    state.error = null;
}
async function refreshProfilesAndSelection(preferredProfileId) {
    state.profiles = await window.passNest.profiles.list();
    if (preferredProfileId &&
        state.profiles.some((profile) => profile.id === preferredProfileId)) {
        state.selectedProfileId = preferredProfileId;
    }
    else if (state.selectedProfileId &&
        state.profiles.some((profile) => profile.id === state.selectedProfileId)) {
        // keep the current selection if it still exists
    }
    else {
        state.selectedProfileId = state.profiles[0]?.id ?? null;
    }
    await loadEntries();
    if (state.editingEntryId &&
        !state.entries.some((entry) => entry.id === state.editingEntryId)) {
        state.editingEntryId = null;
    }
}
function getInputValue(selector) {
    const input = document.querySelector(selector);
    return input?.value.trim() ?? '';
}
function getRawInputValue(selector) {
    const input = document.querySelector(selector);
    return input?.value ?? '';
}
function getCheckboxValue(selector) {
    const input = document.querySelector(selector);
    return input?.checked ?? false;
}
function toMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Something went wrong.';
}
function generateSuggestedPassword(length = 20) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('');
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
export {};
