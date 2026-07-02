type ChromeCallback<T = unknown> = (value: T) => void;

interface ChromeRuntime {
  id?: string;
  onInstalled: { addListener(listener: () => void): void };
  onMessage: { addListener(listener: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean | void): void };
  sendMessage<T = unknown>(message: unknown, callback?: ChromeCallback<T>): void;
  openOptionsPage?(): void;
  lastError?: { message: string };
}

interface ChromeStorageArea {
  get<T = Record<string, unknown>>(keys?: string | string[] | Record<string, unknown> | null): Promise<T>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeTabs {
  query(queryInfo: Record<string, unknown>, callback: (tabs: Array<{ id?: number; url?: string }>) => void): void;
  sendMessage(tabId: number, message: unknown, callback?: ChromeCallback): void;
}

interface ChromeContextMenus {
  create(properties: Record<string, unknown>): void;
  removeAll(callback?: () => void): void;
  onClicked: { addListener(listener: (info: { menuItemId?: string | number; selectionText?: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void): void };
}

interface ChromeSidePanel {
  open(options: { tabId?: number; windowId?: number }): Promise<void>;
}

interface ChromeAlarms {
  create(name: string, alarmInfo: { periodInMinutes?: number; delayInMinutes?: number }): void;
  onAlarm: { addListener(listener: (alarm: { name: string }) => void): void };
}

interface ChromeApi {
  runtime: ChromeRuntime;
  storage: { local: ChromeStorageArea };
  tabs: ChromeTabs;
  contextMenus: ChromeContextMenus;
  sidePanel?: ChromeSidePanel;
  alarms?: ChromeAlarms;
}

declare const chrome: ChromeApi;
