import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import type { FieldInfo, FillFieldsResponse, ScanFieldsResponse } from "@/types/autofill";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeField(domIndex: number, label: string): FieldInfo {
  return {
    domIndex,
    tag: "input",
    type: "text",
    name: label.toLowerCase(),
    id: `${label.toLowerCase()}-id`,
    placeholder: `${label} placeholder`,
    label,
    value: "",
    visible: true,
    disabled: false,
    readOnly: false,
  };
}

type ChromeMessage = {
  type: "SCAN_FIELDS" | "FILL_FIELDS";
};

describe("App adversarial tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockChromeWithSender(
    sendMessageImpl: (
      tabId: number,
      message: ChromeMessage,
    ) => Promise<ScanFieldsResponse | FillFieldsResponse>,
  ) {
    const queryMock = vi.fn().mockResolvedValue([{ id: 42 }]);
    const sendMessageMock = vi.fn(sendMessageImpl);
    const executeScriptMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      writable: true,
      value: {
        tabs: {
          query: queryMock,
          sendMessage: sendMessageMock,
        },
        scripting: {
          executeScript: executeScriptMock,
        },
      },
    });

    return { queryMock, sendMessageMock, executeScriptMock };
  }

  it("baseline: renders scanned fields", async () => {
    mockChromeWithSender(async (_tabId, message) => {
      if (message.type === "SCAN_FIELDS") {
        return {
          fields: [makeField(1, "Email")],
          title: "Job Application",
          url: "https://example.com/job",
        };
      }

      return { updated: 1, total: 1 };
    });

    render(<App />);

    expect(await screen.findByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Job Application")).toBeInTheDocument();
  });

  it("break: keeps stale success visible if post-fill rescan fails", async () => {
    let scanCount = 0;

    mockChromeWithSender(async (_tabId, message) => {
      if (message.type === "SCAN_FIELDS") {
        scanCount += 1;

        if (scanCount === 1) {
          return {
            fields: [makeField(1, "Email")],
            title: "Job Application",
            url: "https://example.com/job",
          };
        }

        throw new Error("Follow-up scan failed");
      }

      return { updated: 1, total: 1 };
    });

    render(<App />);
    await screen.findByText("Email");

    await userEvent.click(screen.getByRole("button", { name: /fill webpage form/i }));

    expect(await screen.findByText("Action failed")).toBeInTheDocument();
    expect(screen.queryByText(/Filled 1 of 1 fields on the webpage\./i)).not.toBeInTheDocument();
  });

  it("break: stale scan response overwrites newer scan data", async () => {
    const slowRefresh = deferred<ScanFieldsResponse>();
    const fastRefresh = deferred<ScanFieldsResponse>();
    const fillPending = deferred<FillFieldsResponse>();
    let scanCount = 0;

    mockChromeWithSender(async (_tabId, message) => {
      if (message.type === "SCAN_FIELDS") {
        scanCount += 1;

        if (scanCount === 1) {
          return { fields: [makeField(1, "Email")], title: "", url: "" };
        }

        if (scanCount === 2) {
          return slowRefresh.promise;
        }

        if (scanCount === 3) {
          return fastRefresh.promise;
        }

        return { fields: [], title: "", url: "" };
      }

      return fillPending.promise;
    });

    render(<App />);
    await screen.findByText("Email");

    await userEvent.click(screen.getByRole("button", { name: /fill webpage form/i }));
    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    await userEvent.click(refreshButton);

    fillPending.resolve({ updated: 1, total: 1 });

    fastRefresh.resolve({
      fields: [makeField(20, "Latest response")],
      title: "",
      url: "",
    });

    expect(await screen.findByText("Latest response")).toBeInTheDocument();

    slowRefresh.resolve({
      fields: [makeField(10, "Stale response")],
      title: "",
      url: "",
    });

    await waitFor(() => {
      expect(screen.queryByText("Stale response")).not.toBeInTheDocument();
    });
  });

  it("break: allows duplicate submits while first fill is still pending", async () => {
    let fillRequestCount = 0;

    mockChromeWithSender(async (_tabId, message) => {
      if (message.type === "SCAN_FIELDS") {
        return {
          fields: [makeField(1, "Email")],
          title: "Job Application",
          url: "https://example.com/job",
        };
      }

      fillRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { updated: 1, total: 1 };
    });

    render(<App />);
    await screen.findByText("Email");

    const submit = screen.getByRole("button", { name: /fill webpage form/i });
    const form = submit.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(fillRequestCount).toBe(1);
    });
  });
});
