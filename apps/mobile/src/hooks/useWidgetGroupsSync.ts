import { useEffect } from 'react';
import { syncWidgetGroups } from '../lib/widget-bridge';
import type { Group } from '../services/groups';

/** Mantiene la lista de grupos disponible para la pantalla nativa de
 * configuración del widget. Best-effort: en web es no-op. */
export function useWidgetGroupsSync(groups: Group[] | undefined): void {
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    void syncWidgetGroups(groups.map(({ id, name, emoji }) => ({ id, name, emoji })));
  }, [groups]);
}
