import type { PassNestApi } from '../preload/api-types';

declare global {
  interface Window {
    passNest: PassNestApi;
  }
}

export {};
