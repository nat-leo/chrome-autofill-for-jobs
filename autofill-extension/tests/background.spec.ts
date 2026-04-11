import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (message: any, sender: any, sendResponse: (response: any) => void) => boolean;

type ChromeMock = {
  runtime: {
    lastError: { message?: string } | null;
    onInstalled: { addListener: ReturnType<typeof vi.fn> };
    onMessage: { addListener: ReturnType<typeof vi.fn> };
  };
  sidePanel: {
    setPanelBehavior: ReturnType<typeof vi.fn>;
  };
  tabs: {
    get: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
};

function createChromeMock(): ChromeMock {
  return {
    runtime: {
      lastError: null,
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    sidePanel: {
      setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      get: vi.fn().mockResolvedValue({ id: 123 }),
      sendMessage: vi.fn((_tabId, _message, callback) => callback({ ok: true, data: [] })),
    },
  };
}

async function loadBackgroundModule(chromeMock: ChromeMock): Promise<Listener> {
  vi.resetModules();
  (globalThis as any).chrome = chromeMock;

  await import("../src/scripts/background.js");

  const listener = chromeMock.runtime.onMessage.addListener.mock.calls[0]?.[0] as Listener | undefined;
  if (!listener) throw new Error("background onMessage listener was not registered");
  return listener;
}

async function invokeListener(listener: Listener, request: any): Promise<any> {
  return await new Promise<any>((resolve) => {
    const returned = listener(request, {}, resolve);
    expect(returned).toBe(true);
  });
}

describe("v0/background messaging contract", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
    vi.restoreAllMocks();
  });

  it("returns INVALID_REQUEST when request does not include a supported type", async () => {
    const chromeMock = createChromeMock();
    const listener = await loadBackgroundModule(chromeMock);

    const response = await invokeListener(listener, { tabId: 123 });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Message must include a valid type.",
      },
    });
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("routes SCAN_FIELDS to content script without a tabId in the internal payload", async () => {
    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback({ ok: true, data: [{ id: "id:email" }] });
    });

    const listener = await loadBackgroundModule(chromeMock);
    const response = await invokeListener(listener, { type: "SCAN_FIELDS", tabId: 123 });

    expect(chromeMock.tabs.get).toHaveBeenCalledWith(123);
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      { type: "SCAN_FIELDS" },
      expect.any(Function),
    );
    expect(response).toEqual({ ok: true, data: [{ id: "id:email" }] });
  });

  it("routes FILL_FIELDS with payload and preserves per-field results", async () => {
    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback({
        ok: true,
        data: {
          filled: [
            { fieldId: "id:first-name", success: true },
            { fieldId: "id:file", success: false, message: "FIELD_NOT_FILLABLE" },
          ],
        },
      });
    });

    const listener = await loadBackgroundModule(chromeMock);
    const payload = [
      { fieldId: "id:first-name", value: "Nate" },
      { fieldId: "id:file", value: "ignored" },
    ];

    const response = await invokeListener(listener, { type: "FILL_FIELDS", tabId: 123, payload });

    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      { type: "FILL_FIELDS", payload },
      expect.any(Function),
    );
    expect(response).toEqual({
      ok: true,
      data: {
        filled: [
          { fieldId: "id:first-name", success: true },
          { fieldId: "id:file", success: false, message: "FIELD_NOT_FILLABLE" },
        ],
      },
    });
  });

  it("maps content-script INVALID_PAYLOAD to extension INVALID_REQUEST", async () => {
    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback({
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "FILL_FIELDS requires an array payload.",
        },
      });
    });

    const listener = await loadBackgroundModule(chromeMock);
    const response = await invokeListener(listener, { type: "READ_FIELDS", tabId: 123 });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "FILL_FIELDS requires an array payload.",
      },
    });
  });

  it("returns CONTENT_SCRIPT_UNAVAILABLE when chrome runtime reports transport failure", async () => {
    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      chromeMock.runtime.lastError = { message: "Receiving end does not exist." };
      callback(undefined);
      chromeMock.runtime.lastError = null;
    });

    const listener = await loadBackgroundModule(chromeMock);
    const response = await invokeListener(listener, { type: "READ_ACTIVE_ELEMENT", tabId: 123 });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "CONTENT_SCRIPT_UNAVAILABLE",
        message: "Receiving end does not exist.",
      },
    });
  });

  it("normalizes READ_PAGE_CONTENT metadata into formContext per extension API", async () => {
    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback({
        ok: true,
        data: {
          url: "https://jobs.example.com/apply/1",
          title: "Apply",
          headings: ["Apply", 22],
          sectionHeadings: ["Experience", null],
          visibleText: "Complete all required fields",
          metadata: {
            platform: "Workday",
            section: "Resume",
            company: "Example Co",
            jobTitle: "Engineer",
          },
        },
      });
    });

    const listener = await loadBackgroundModule(chromeMock);
    const response = await invokeListener(listener, { type: "READ_PAGE_CONTENT", tabId: 123 });

    expect(response).toEqual({
      ok: true,
      data: {
        url: "https://jobs.example.com/apply/1",
        title: "Apply",
        headings: ["Apply", "22"],
        sectionHeadings: ["Experience", "null"],
        visibleText: "Complete all required fields",
        formContext: {
          platform: "Workday",
          section: "Resume",
          company: "Example Co",
          jobTitle: "Engineer",
        },
      },
    });
  });

  it("returns TIMEOUT when content script does not respond within timeout window", async () => {
    vi.useFakeTimers();

    const chromeMock = createChromeMock();
    chromeMock.tabs.sendMessage.mockImplementation(() => {
      // intentionally do not invoke callback
    });

    const listener = await loadBackgroundModule(chromeMock);
    const responsePromise = invokeListener(listener, { type: "SCAN_FIELDS", tabId: 123 });

    await vi.advanceTimersByTimeAsync(5000);

    await expect(responsePromise).resolves.toEqual({
      ok: false,
      error: {
        code: "TIMEOUT",
        message: "Content script request timed out after 5000ms.",
      },
    });
  });
});
