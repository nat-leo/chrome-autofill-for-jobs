# Chrome Extension Artchitecture

*UI Panel <-> Service Worker <-> Content Script*

There's three things in this extension:

1. **Content scripts** execute code in the browser.
2. **Sidebar** is a nice UI/dashboard for users to see what they've done and customize what the extension does. 
3. **Service workers** form a communication bridge between the UI and content scripts. If the scripts scan/read a page, they send the data to the service worker, who sends it to the UI. If the UI exectues a button click, updates information, opens a new sidebar component, it sends that info to the service worker, which then tells the content scripts what to execute.

How the interface between UI and Service Worker will be designed is in [The Extension Messaging API](docs/interfaces/content-script-messaging-api.md)


How the interface between Service Worker and Content Script will be designed is in [The Content Script Messaging API](docs/interfaces/extension-messaging-api.md)


# Example Code that Implements Our Architecture:

**SCAN_FIELDS Sample Workflow in Our Architecture.** 

In Our Chrome Extension Sidebar, we're gonna scan the fields on the webpage by clicking a button

## End-to-end flow

When the user clicks the button in the sidebar:

```ts
const tabId = await getCurrentTabId();
const response = await scanFields(tabId);
```

That does this:

1. **UI** calls `chrome.runtime.sendMessage({ type: "SCAN_FIELDS", tabId })`
2. **service worker** receives it
3. service worker calls `chrome.tabs.sendMessage(tabId, { type: "SCAN_FIELDS" })`
4. **content script** scans the DOM
5. content script returns normalized field data
6. service worker passes that back
7. UI renders the result


In your sidebar React app:

```ts
// src/lib/extension-api.ts

export type FillFieldInput = {
  fieldId: string;
  value: string;
};

export type ExtensionErrorCode =
  | "NO_ACTIVE_TAB"
  | "TAB_NOT_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "UNKNOWN";

export type ExtensionResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: ExtensionErrorCode;
        message: string;
      };
    };

export type ScannedField = {
  id: string;
  kind: string;
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  visible: boolean;
  editable: boolean;
  confidence: number;
};

export type ExtensionRequest =
  | { type: "SCAN_FIELDS"; tabId: number }
  | { type: "READ_FIELDS"; tabId: number }
  | { type: "READ_ACTIVE_ELEMENT"; tabId: number }
  | { type: "READ_PAGE_CONTENT"; tabId: number }
  | { type: "FILL_FIELDS"; tabId: number; payload: FillFieldInput[] };

export async function sendExtensionRequest<T>(
  request: ExtensionRequest
): Promise<ExtensionResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(request);
    return response as ExtensionResponse<T>;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message:
          error instanceof Error ? error.message : "Failed to send message",
      },
    };
  }
}

export async function scanFields(
  tabId: number
): Promise<ExtensionResponse<ScannedField[]>> {
  return sendExtensionRequest<ScannedField[]>({
    type: "SCAN_FIELDS",
    tabId,
  });
}
```

---

## 2. UI gets the target tab id

If your side panel should operate on the currently active tab:

```ts
// src/lib/tabs.ts

export async function getCurrentTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0]?.id ?? null;
}
```

---

## 3. Button click in the sidebar executes `SCAN_FIELDS`

Example React component:

```tsx
// src/components/DetectedFieldsPanel.tsx

import { useState } from "react";
import { getCurrentTabId } from "../lib/tabs";
import { scanFields, type ScannedField } from "../lib/extension-api";

export default function DetectedFieldsPanel() {
  const [fields, setFields] = useState<ScannedField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScanFields() {
    setLoading(true);
    setError(null);

    try {
      const tabId = await getCurrentTabId();

      if (!tabId) {
        setError("No active tab found.");
        return;
      }

      const response = await scanFields(tabId);

      if (!response.ok) {
        setError(`${response.error.code}: ${response.error.message}`);
        return;
      }

      setFields(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={handleScanFields}
        disabled={loading}
        className="rounded-md border px-3 py-2"
      >
        {loading ? "Scanning..." : "Refresh"}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id} className="rounded border p-2 text-sm">
            <div><strong>Label:</strong> {field.label ?? "(none)"}</div>
            <div><strong>Kind:</strong> {field.kind}</div>
            <div><strong>Name:</strong> {field.name ?? "(none)"}</div>
            <div><strong>Placeholder:</strong> {field.placeholder ?? "(none)"}</div>
            <div><strong>Visible:</strong> {String(field.visible)}</div>
            <div><strong>Editable:</strong> {String(field.editable)}</div>
            <div><strong>Confidence:</strong> {field.confidence}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

That is the UI side.

The important line is:

```ts
const response = await scanFields(tabId);
```

which sends:

```ts
{ type: "SCAN_FIELDS", tabId }
```

to the service worker.

---

## 4. Service worker receives `SCAN_FIELDS`

Background/service worker:

```ts
// src/scripts/background.ts

type FillFieldInput = {
  fieldId: string;
  value: string;
};

type ExtensionErrorCode =
  | "NO_ACTIVE_TAB"
  | "TAB_NOT_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "UNKNOWN";

type ExtensionResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ExtensionErrorCode;
        message: string;
      };
    };

type ScannedField = {
  id: string;
  kind: string;
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  visible: boolean;
  editable: boolean;
  confidence: number;
};

type ExtensionRequest =
  | { type: "SCAN_FIELDS"; tabId: number }
  | { type: "READ_FIELDS"; tabId: number }
  | { type: "READ_ACTIVE_ELEMENT"; tabId: number }
  | { type: "READ_PAGE_CONTENT"; tabId: number }
  | { type: "FILL_FIELDS"; tabId: number; payload: FillFieldInput[] };

type ContentScriptRequest =
  | { type: "SCAN_FIELDS" }
  | { type: "READ_FIELDS" }
  | { type: "READ_ACTIVE_ELEMENT" }
  | { type: "READ_PAGE_CONTENT" }
  | { type: "FILL_FIELDS"; payload: FillFieldInput[] };

function ok<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function err(
  code: ExtensionErrorCode,
  message: string
): ExtensionResponse<never> {
  return {
    ok: false,
    error: { code, message },
  };
}

async function sendToTab<T>(
  tabId: number,
  message: ContentScriptRequest
): Promise<ExtensionResponse<T>> {
  try {
    const tab = await chrome.tabs.get(tabId);

    if (!tab?.id) {
      return err("TAB_NOT_FOUND", `Tab ${tabId} was not found.`);
    }

    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as ExtensionResponse<T>;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown sendMessage failure";

    if (
      messageText.includes("Receiving end does not exist") ||
      messageText.includes("Could not establish connection")
    ) {
      return err(
        "CONTENT_SCRIPT_UNAVAILABLE",
        "Content script is not available in this tab."
      );
    }

    return err("UNKNOWN", messageText);
  }
}

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  (async () => {
    if (!request || typeof request !== "object" || !("type" in request)) {
      sendResponse(err("INVALID_REQUEST", "Malformed extension request."));
      return;
    }

    switch (request.type) {
      case "SCAN_FIELDS": {
        const response = await sendToTab<ScannedField[]>(request.tabId, {
          type: "SCAN_FIELDS",
        });
        sendResponse(response);
        return;
      }

      case "READ_FIELDS": {
        const response = await sendToTab(request.tabId, {
          type: "READ_FIELDS",
        });
        sendResponse(response);
        return;
      }

      case "READ_ACTIVE_ELEMENT": {
        const response = await sendToTab(request.tabId, {
          type: "READ_ACTIVE_ELEMENT",
        });
        sendResponse(response);
        return;
      }

      case "READ_PAGE_CONTENT": {
        const response = await sendToTab(request.tabId, {
          type: "READ_PAGE_CONTENT",
        });
        sendResponse(response);
        return;
      }

      case "FILL_FIELDS": {
        const response = await sendToTab(request.tabId, {
          type: "FILL_FIELDS",
          payload: request.payload,
        });
        sendResponse(response);
        return;
      }

      default: {
        sendResponse(err("INVALID_REQUEST", "Unsupported request type."));
      }
    }
  })();

  return true;
});
```

---

## 5. Content script handles `SCAN_FIELDS`

```ts
// src/scripts/content.ts

type ExtensionErrorCode =
  | "NO_ACTIVE_TAB"
  | "TAB_NOT_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "UNKNOWN";

type ExtensionResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ExtensionErrorCode;
        message: string;
      };
    };

type ScannedField = {
  id: string;
  kind: string;
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  visible: boolean;
  editable: boolean;
  confidence: number;
};

type ContentScriptRequest =
  | { type: "SCAN_FIELDS" }
  | { type: "READ_FIELDS" }
  | { type: "READ_ACTIVE_ELEMENT" }
  | { type: "READ_PAGE_CONTENT" }
  | { type: "FILL_FIELDS"; payload: Array<{ fieldId: string; value: string }> };

function ok<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function err(
  code: ExtensionErrorCode,
  message: string
): ExtensionResponse<never> {
  return {
    ok: false,
    error: { code, message },
  };
}

function getEditableFieldElements(): Element[] {
  return [
    ...document.querySelectorAll(`
      input,
      textarea,
      select,
      [contenteditable="true"],
      [role="textbox"],
      [role="searchbox"],
      [role="combobox"]
    `),
  ];
}

function getLabelForElement(el: Element): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const labelText = label?.textContent?.trim();
      if (labelText) return labelText;
    }
  }

  const wrappingLabel = el.closest("label");
  const wrappingLabelText = wrappingLabel?.textContent?.trim();
  if (wrappingLabelText) return wrappingLabelText;

  return undefined;
}

function inferKind(el: Element): string {
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLInputElement) return el.type || "text";

  const role = el.getAttribute("role");
  return role || "unknown";
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function isEditable(el: Element): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return !el.disabled && !el.readOnly;
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }

  return true;
}

function buildFieldId(el: Element, index: number): string {
  if (el instanceof HTMLElement && el.dataset.autofillId) {
    return el.dataset.autofillId;
  }

  const id =
    (el instanceof HTMLElement && el.id) ||
    el.getAttribute("name") ||
    `${el.tagName.toLowerCase()}-${index}`;

  if (el instanceof HTMLElement) {
    el.dataset.autofillId = id;
  }

  return id;
}

function scanFields(): ScannedField[] {
  return getEditableFieldElements().map((el, index) => ({
    id: buildFieldId(el, index),
    kind: inferKind(el),
    label: getLabelForElement(el),
    name:
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
        ? el.name || undefined
        : undefined,
    placeholder:
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.placeholder || undefined
        : undefined,
    required:
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
        ? el.required
        : undefined,
    visible: isVisible(el),
    editable: isEditable(el),
    confidence: 0.8,
  }));
}

chrome.runtime.onMessage.addListener(
  (request: ContentScriptRequest, _sender, sendResponse) => {
    try {
      switch (request.type) {
        case "SCAN_FIELDS":
          sendResponse(ok(scanFields()));
          return;

        default:
          sendResponse(err("INVALID_REQUEST", "Unsupported content request."));
          return;
      }
    } catch (error) {
      sendResponse(
        err(
          "UNKNOWN",
          error instanceof Error ? error.message : "Unknown content error"
        )
      );
    }
  }
);
```
