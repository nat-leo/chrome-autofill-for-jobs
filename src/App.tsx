import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type FieldInfo = {
  domIndex: number;
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

type ScanFieldsResponse = {
  fields?: FieldInfo[];
  title?: string;
  url?: string;
};

type FillFieldPayload = {
  domIndex: number;
  value: string;
};

type FillFieldsResponse = {
  updated: number;
  total: number;
  error?: string;
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

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return tab.id;
}

export default function App() {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function scanActiveTab() {
    try {
      setError("");

      const tabId = await getActiveTabId();
      const response = await sendMessageWithRetry<ScanFieldsResponse>(tabId, {
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

  function handleFieldValueChange(domIndex: number, value: string) {
    setFields((prev) =>
      prev.map((field) =>
        field.domIndex === domIndex
          ? {
              ...field,
              value,
            }
          : field,
      ),
    );
  }

  async function handleFillSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fields.length) {
      setError("No fields available to fill.");
      return;
    }

    try {
      setError("");
      setStatus("");

      const tabId = await getActiveTabId();
      const payload: FillFieldPayload[] = fields.map((field) => ({
        domIndex: field.domIndex,
        value: field.value ?? "",
      }));

      const result = await sendMessageWithRetry<FillFieldsResponse>(tabId, {
        type: "FILL_FIELDS",
        fields: payload,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      setStatus(`Filled ${result?.updated ?? 0} of ${result?.total ?? payload.length} fields on the webpage.`);
      await scanActiveTab();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void scanActiveTab();
  }, []);

  return (
    <div style={{ padding: 12, fontFamily: "sans-serif" }}>
      <h2>Detected fields</h2>
      <button type="button" onClick={scanActiveTab}>Refresh</button>

      {pageTitle && <p><strong>Page:</strong> {pageTitle}</p>}
      {pageUrl && <p style={{ wordBreak: "break-all" }}>{pageUrl}</p>}
      {error && <p style={{ color: "#b42318" }}>{error}</p>}
      {status && <p style={{ color: "#027a48" }}>{status}</p>}

      <form onSubmit={handleFillSubmit}>
        <ul style={{ padding: 0, listStyle: "none" }}>
          {fields.map((field) => (
            <li
              key={`${field.domIndex}-${field.id}-${field.name}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
              }}
            >
              <input
                type="text"
                value={field.value || ""}
                onChange={(event) => handleFieldValueChange(field.domIndex, event.target.value)}
                placeholder={field.placeholder || field.label || "Field value"}
                disabled={field.disabled || field.readOnly}
                style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
              />

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

        <button type="submit" style={{ marginTop: 12 }} disabled={!fields.length}>
          Fill Webpage Form
        </button>
      </form>
    </div>
  );
}
