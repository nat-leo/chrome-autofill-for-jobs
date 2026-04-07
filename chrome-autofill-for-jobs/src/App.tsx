import { useEffect, useState } from "react";

type FieldInfo = {
  tag: string;
  type: string | null;
  name: string;
  id: string;
  placeholder: string;
  label: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  readOnly: boolean;
};

const CONTENT_SCRIPT_FILE = "chrome-autofill-for-jobs/src/scripts/content.js";

function getErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return "Failed to scan fields.";

  if (
    err.message.includes("Missing host permission") ||
    err.message.includes("Cannot access contents of the page") ||
    err.message.includes("The extensions gallery cannot be scripted")
  ) {
    return "This extension does not currently have access to this site. Grant site access (or reload the extension after permission changes) and try again.";
  }

  if (err.message.includes("Receiving end does not exist")) {
    return "No listener found on this tab. Reload the tab and extension, then try Refresh again.";
  }

  return err.message;
}

async function sendMessageWithRetry<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("Receiving end does not exist")) {
      throw err;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });

    return await chrome.tabs.sendMessage(tabId, message);
  }
}

export default function App() {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [error, setError] = useState("");

  async function scanActiveTab() {
    try {
      setError("");

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        throw new Error("No active tab found.");
      }

      const response = await sendMessageWithRetry<{
        fields?: FieldInfo[];
        title?: string;
        url?: string;
      }>(tab.id, {
        type: "SCAN_FIELDS",
      });

      setFields(response?.fields ?? []);
      setPageTitle(response?.title ?? "");
      setPageUrl(response?.url ?? "");
    } catch (err) {
      setError(getErrorMessage(err));
      setFields([]);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab?.id) return;

        const res = await sendMessageWithRetry<{ fields?: FieldInfo[] }>(tab.id, {
          type: "READ_FIELDS",
        });

        setFields(res?.fields || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 12, fontFamily: "sans-serif" }}>
      <h2>Detected fields</h2>
      <button onClick={scanActiveTab}>Refresh</button>

      {pageTitle && <p><strong>Page:</strong> {pageTitle}</p>}
      {pageUrl && <p style={{ wordBreak: "break-all" }}>{pageUrl}</p>}
      {error && <p>{error}</p>}

      <ul style={{ padding: 0, listStyle: "none" }}>
        {fields.map((field, i) => (
          <li
            key={`${field.id}-${field.name}-${i}`}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 10,
              marginTop: 8,
            }}
          >
            <div><strong>{field.label || field.placeholder || field.name || field.id || "(unlabeled field)"}</strong></div>
            <div>tag: {field.tag}</div>
            <div>type: {field.type ?? "-"}</div>
            <div>name: {field.name || "-"}</div>
            <div>id: {field.id || "-"}</div>
            <div>placeholder: {field.placeholder || "-"}</div>
            <div>value: {field.value || "-"}</div>
            <div>visible: {String(field.visible)}</div>
            <div>disabled: {String(field.disabled)}</div>
            <div>readonly: {String(field.readOnly)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
