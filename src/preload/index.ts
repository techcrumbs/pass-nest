import { contextBridge, ipcRenderer } from 'electron';
import type { PassNestApi } from './api-types';

const IPC_CHANNELS = {
  appGetBootstrapStatus: 'app:getBootstrapStatus',
  appCopyText: 'app:copyText',
  vaultSetup: 'vault:setup',
  vaultUnlock: 'vault:unlock',
  vaultLock: 'vault:lock',
  vaultGetStatus: 'vault:getStatus',
  vaultSetTrustedDeviceUnlock: 'vault:setTrustedDeviceUnlock',
  profilesList: 'profiles:list',
  profilesCreate: 'profiles:create',
  profilesUpdate: 'profiles:update',
  profilesDelete: 'profiles:delete',
  entriesListByProfile: 'entries:listByProfile',
  entriesCreate: 'entries:create',
  entriesUpdate: 'entries:update',
  entriesDelete: 'entries:delete',
  entriesCopyPassword: 'entries:copyPassword',
} as const;

const api: PassNestApi = {
  app: {
    getBootstrapStatus: () => ipcRenderer.invoke(IPC_CHANNELS.appGetBootstrapStatus),
    copyText: (input) => ipcRenderer.invoke(IPC_CHANNELS.appCopyText, input),
  },
  vault: {
    setup: (input) => ipcRenderer.invoke(IPC_CHANNELS.vaultSetup, input),
    unlock: (input) => ipcRenderer.invoke(IPC_CHANNELS.vaultUnlock, input),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.vaultLock),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.vaultGetStatus),
    setTrustedDeviceUnlock: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSetTrustedDeviceUnlock, input),
  },
  profiles: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.profilesList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesUpdate, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesDelete, input),
  },
  entries: {
    listByProfile: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.entriesListByProfile, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesUpdate, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesDelete, input),
    copyPassword: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.entriesCopyPassword, input),
  },
};

contextBridge.exposeInMainWorld('passNest', api);
