import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { FieldList } from "@/components/autofill/FieldList";
import { FillActions } from "@/components/autofill/FillActions";
import { PageSummary } from "@/components/autofill/PageSummary";
import { PanelHeader } from "@/components/autofill/PanelHeader";
import { StatusNotice } from "@/components/autofill/StatusNotice";
import type {
  FieldInfo,
  FillFieldPayload,
  FillFieldsResponse,
  ScanFieldsResponse,
} from "@/types/autofill";

const CONTENT_SCRIPT_FILE = "chrome-autofill-for-jobs/src/scripts/content.js";

function getErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return "Request failed.";

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
  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const scanActiveTab = useCallback(async () => {
    setIsScanning(true);
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
      setPageTitle("");
      setPageUrl("");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleFieldValueChange = useCallback((domIndex: number, value: string) => {
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
  }, []);

  const handleFillSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!fields.length) {
        setError("No fields available to fill.");
        return;
      }

      setIsFilling(true);
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

        setStatus(
          `Filled ${result?.updated ?? 0} of ${result?.total ?? payload.length} fields on the webpage.`,
        );
        await scanActiveTab();
      } catch (err) {
        setError(getErrorMessage(err));
        setStatus("");
      } finally {
        setIsFilling(false);
      }
    },
    [fields, scanActiveTab],
  );

  useEffect(() => {
    void scanActiveTab();
  }, [scanActiveTab]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 p-3">
        <PanelHeader
          fieldCount={fields.length}
          isScanning={isScanning}
          onRefresh={scanActiveTab}
        />

        <PageSummary pageTitle={pageTitle} pageUrl={pageUrl} />
        <StatusNotice error={error} status={status} />

        <form className="space-y-3" onSubmit={handleFillSubmit}>
          <FieldList
            fields={fields}
            isScanning={isScanning}
            onFieldValueChange={handleFieldValueChange}
          />

          <FillActions
            disabled={!fields.length || isScanning || isFilling}
            isFilling={isFilling}
          />
        </form>
      </main>
    </div>
  );
}
