import { Capacitor, registerPlugin } from '@capacitor/core';
import { widgetService } from '../services/widget';

export interface WidgetGroup {
  id: string;
  name: string;
  emoji: string;
}

interface WidgetBridgePlugin {
  hasSession(): Promise<{ value: boolean }>;
  setSession(options: { token: string; apiUrl: string }): Promise<void>;
  clearSession(): Promise<void>;
  setGroups(options: { groups: WidgetGroup[] }): Promise<void>;
  refreshWidgets(): Promise<void>;
}

let WidgetBridge: WidgetBridgePlugin | null = null;

function getWidgetBridge(): WidgetBridgePlugin {
  if (!WidgetBridge) {
    WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
  }
  return WidgetBridge;
}

function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Todo el bridge es best-effort: el widget es un extra, nunca puede romper
 * el flujo de la app. Cada función es no-op fuera de Android y traga errores.
 */
export async function syncWidgetSession(): Promise<void> {
  if (!isAndroid()) return;
  try {
    const widget = getWidgetBridge();
    const { value } = await widget.hasSession();
    if (value) return;
    const { token } = await widgetService.issueToken();
    await widget.setSession({ token, apiUrl: import.meta.env.VITE_API_URL });
  } catch {
    // sin sesión de widget: el widget mostrará «Abre Quedamos»
  }
}

export async function clearWidgetSession(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await widgetService.revokeToken();
  } catch {
    // la revocación remota es best-effort; el borrado local va igualmente
  }
  try {
    const widget = getWidgetBridge();
    await widget.clearSession();
  } catch {
    // plugin no disponible: nada que limpiar
  }
}

export async function syncWidgetGroups(groups: WidgetGroup[]): Promise<void> {
  if (!isAndroid()) return;
  try {
    const widget = getWidgetBridge();
    await widget.setGroups({ groups });
  } catch {
    // best-effort
  }
}

export async function notifyWidgetDataChanged(): Promise<void> {
  if (!isAndroid()) return;
  try {
    const widget = getWidgetBridge();
    await widget.refreshWidgets();
  } catch {
    // best-effort
  }
}
