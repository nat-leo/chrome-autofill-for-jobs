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

function sendMessageToBackground<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Failed to reach extension service worker."));
        return;
      }

      resolve(response);
    });
  });
}

type ActiveTabContext = {
  tabId: number;
  title: string;
  url: string;
};

async function getActiveTabContext(): Promise<ActiveTabContext> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return {
    tabId: tab.id,
    title: tab.title ?? "",
    url: tab.url ?? "",
  };
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

      const tab = await getActiveTabContext();
      const response = await sendMessageToBackground<ScanFieldsResponse>({
        type: "SCAN_FIELDS",
        tabId: tab.tabId,
      });

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      setFields((previousFields) => {
        const previousValues = new Map(previousFields.map((field) => [field.id, field.value]));
        return response.data.map((field) => ({
          ...field,
          value: previousValues.get(field.id) ?? "",
        }));
      });
      setPageTitle(tab.title);
      setPageUrl(tab.url);
    } catch (err) {
      setError(getErrorMessage(err));
      setFields([]);
      setPageTitle("");
      setPageUrl("");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleFieldValueChange = useCallback((fieldId: string, value: string) => {
    setFields((prev) =>
      prev.map((field) =>
        field.id === fieldId
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

        const tab = await getActiveTabContext();
        const payload: FillFieldPayload[] = fields.map((field) => ({
          fieldId: field.id,
          value: field.value ?? "",
        }));

        const result = await sendMessageToBackground<FillFieldsResponse>({
          type: "FILL_FIELDS",
          tabId: tab.tabId,
          payload,
        });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        const total = result.data.filled.length;
        const updated = result.data.filled.filter((item) => item.success).length;

        setStatus(
          `Filled ${updated} of ${total || payload.length} fields on the webpage.`,
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
