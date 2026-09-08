import { api } from '../lib/api';

/** One notice as it lives in the bandeja. */
export interface InboxNotification {
  id: string;
  /** Same value the push carries in `data.type`; drives the routing of a tap. */
  type: string;
  title: string;
  body: string;
  /** The push payload the notice was sent with, or null for a notice with no routing. */
  data: Record<string, string> | null;
  /** ISO timestamp, or null while it is still unread. */
  readAt: string | null;
  createdAt: string;
}

export interface InboxPage {
  items: InboxNotification[];
  /** Send back as `cursor` to get the next page; null when there is no more. */
  nextCursor: string | null;
  /** Every unread notice, not only the ones in this page. */
  unreadCount: number;
}

export interface ListInboxParams {
  limit?: number;
  cursor?: string;
}

export const inboxService = {
  list: ({ limit, cursor }: ListInboxParams = {}) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (cursor !== undefined) params.set('cursor', cursor);
    const query = params.toString();
    return api.get<InboxPage>(`/notifications${query ? `?${query}` : ''}`);
  },

  readAll: () => api.post<{ updated: number }>('/notifications/read-all', {}),

  read: (id: string) =>
    api.post<{ success: true }>(`/notifications/${encodeURIComponent(id)}/read`, {}),
};
