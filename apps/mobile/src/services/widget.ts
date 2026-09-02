import { api } from '../lib/api';

export const widgetService = {
  issueToken: () => api.post<{ token: string }>('/widget/token', {}),
  revokeToken: () => api.delete<{ success: boolean }>('/widget/token'),
};
