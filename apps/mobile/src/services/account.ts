import { api } from '../lib/api';

export interface DeleteAccountResult {
  success: boolean;
  groupsDeleted: number;
  groupsTransferred: number;
}

export const accountService = {
  /** Deletes the account for good: the auth user, the profile and everything hanging from it. */
  deleteAccount: () => api.delete<DeleteAccountResult>('/auth/me'),

  /** Everything the API holds about the user, as plain JSON. */
  exportData: () => api.get<unknown>('/auth/me/export'),
};
