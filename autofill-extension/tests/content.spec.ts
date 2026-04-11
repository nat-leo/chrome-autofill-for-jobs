import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (message: any, sender: any, sendResponse: (response: any) => void) => boolean;

function createChromeMock() {
  return {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
    },
  };
}

async function loadContentModule(): Promise<Listener> {
  vi.resetModules();

  const chromeMock = createChromeMock();
  (globalThis as any).chrome = chromeMock;

  await import("../src/scripts/content.js");

  const listener = chromeMock.runtime.onMessage.addListener.mock.calls[0]?.[0] as Listener | undefined;
  if (!listener) throw new Error("content onMessage listener was not registered");

  return listener;
}

async function invokeListener(listener: Listener, message: any): Promise<any> {
  return await new Promise<any>((resolve) => {
    const returned = listener(message, {}, resolve);
    expect(returned).toBe(true);
  });
}

describe("v0/content messaging contract", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "";
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
    vi.restoreAllMocks();
  });

  it("returns UNSUPPORTED_COMMAND for unknown command types", async () => {
    const listener = await loadContentModule();

    const response = await invokeListener(listener, { type: "DOES_NOT_EXIST" });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "UNSUPPORTED_COMMAND",
        message: "Unsupported command: DOES_NOT_EXIST",
      },
    });
  });

  it("returns scanned fields with normalized metadata and stable ids", async () => {
    document.body.innerHTML = `
      <label for="email">Email Address</label>
      <input id="email" name="email" type="email" placeholder="name@example.com" required />
    `;

    const input = document.getElementById("email") as HTMLInputElement;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      visibility: "visible",
    } as CSSStyleDeclaration);
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 20,
      top: 100,
      right: 100,
      bottom: 120,
      left: 0,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    const listener = await loadContentModule();

    const firstScan = await invokeListener(listener, { type: "SCAN_FIELDS" });
    const secondScan = await invokeListener(listener, { type: "SCAN_FIELDS" });

    expect(firstScan.ok).toBe(true);
    expect(firstScan.data).toHaveLength(1);
    expect(firstScan.data[0]).toMatchObject({
      id: "id:email",
      kind: "email",
      label: "Email Address",
      name: "email",
      placeholder: "name@example.com",
      required: true,
      visible: true,
      editable: true,
    });

    expect(secondScan.data[0].id).toBe(firstScan.data[0].id);
  });

  it("reads active element using normalized shape", async () => {
    document.body.innerHTML = `
      <h2>Application Questions</h2>
      <label for="cover-letter">Cover Letter</label>
      <textarea id="cover-letter" aria-description="Tell us why you are interested."></textarea>
    `;

    const textarea = document.getElementById("cover-letter") as HTMLTextAreaElement;
    textarea.focus();

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      visibility: "visible",
    } as CSSStyleDeclaration);
    vi.spyOn(textarea, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 120,
      top: 200,
      right: 320,
      bottom: 320,
      left: 0,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });

    const listener = await loadContentModule();
    const response = await invokeListener(listener, { type: "READ_ACTIVE_ELEMENT" });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      tagName: "TEXTAREA",
      kind: "textarea",
      label: "Cover Letter",
      visible: true,
      editable: true,
      focused: true,
      helpText: "Tell us why you are interested.",
      sectionHeading: "Application Questions",
    });
  });

  it("normalizes READ_PAGE_CONTENT payload with forms and metadata", async () => {
    document.title = "Apply | Backend Engineer";
    document.body.innerHTML = `
      <h1>Apply</h1>
      <h2>Experience</h2>
      <form id="job-form" aria-label="Job Application">
        <input name="firstName" />
        <textarea name="summary"></textarea>
      </form>
      <div>Workday application flow</div>
    `;

    Object.defineProperty(document.body, "innerText", {
      configurable: true,
      value: "Workday application flow Experience",
    });

    const listener = await loadContentModule();
    const response = await invokeListener(listener, { type: "READ_PAGE_CONTENT" });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      title: "Apply | Backend Engineer",
      headings: ["Apply", "Experience"],
      sectionHeadings: expect.arrayContaining(["Experience"]),
      forms: [
        {
          index: 0,
          id: "job-form",
          ariaLabel: "Job Application",
          fieldCount: 2,
        },
      ],
      metadata: {
        platform: "Workday",
        section: "Apply",
      },
    });
  });

  it("fills input/select fields and reports element-not-found for stale ids", async () => {
    document.body.innerHTML = `
      <label for="first-name">First Name</label>
      <input id="first-name" type="text" />
      <select id="country">
        <option value="">Select one</option>
        <option value="US">United States</option>
      </select>
    `;

    const input = document.getElementById("first-name") as HTMLInputElement;
    const select = document.getElementById("country") as HTMLSelectElement;

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      visibility: "visible",
    } as CSSStyleDeclaration);
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 20,
      top: 10,
      right: 100,
      bottom: 30,
      left: 0,
      x: 0,
      y: 10,
      toJSON: () => ({}),
    });
    vi.spyOn(select, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 20,
      top: 40,
      right: 100,
      bottom: 60,
      left: 0,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    });

    const listener = await loadContentModule();

    const scanResponse = await invokeListener(listener, { type: "SCAN_FIELDS" });
    expect(scanResponse.ok).toBe(true);

    const firstId = scanResponse.data[0].id;
    const secondId = scanResponse.data[1].id;

    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    input.addEventListener("input", inputEvents);
    input.addEventListener("change", changeEvents);

    const response = await invokeListener(listener, {
      type: "FILL_FIELDS",
      payload: [
        { fieldId: firstId, value: "Nate" },
        { fieldId: secondId, value: "United States" },
        { fieldId: "missing-id", value: "x" },
      ],
    });

    expect(response).toEqual({
      ok: true,
      data: {
        filled: [
          { fieldId: firstId, success: true, message: undefined },
          { fieldId: secondId, success: true, message: undefined },
          { fieldId: "missing-id", success: false, message: "ELEMENT_NOT_FOUND" },
        ],
      },
    });

    expect(input.value).toBe("Nate");
    expect(select.value).toBe("US");
    expect(inputEvents).toHaveBeenCalledTimes(1);
    expect(changeEvents).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_PAYLOAD when FILL_FIELDS payload is not an array", async () => {
    const listener = await loadContentModule();

    const response = await invokeListener(listener, { type: "FILL_FIELDS", payload: "bad" });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "FILL_FIELDS requires an array payload.",
      },
    });
  });
});
