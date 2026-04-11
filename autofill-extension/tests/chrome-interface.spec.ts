import { describe, expect, it } from "vitest";

import {
  EXTENSION_COMMANDS,
  err,
  isExtensionCommandType,
  ok,
} from "../src/lib/chrome-interface";

describe("v0/chrome-interface contract helpers", () => {
  it("exposes all extension command constants from the messaging spec", () => {
    expect(EXTENSION_COMMANDS).toEqual({
      SCAN_FIELDS: "SCAN_FIELDS",
      READ_FIELDS: "READ_FIELDS",
      READ_ACTIVE_ELEMENT: "READ_ACTIVE_ELEMENT",
      READ_PAGE_CONTENT: "READ_PAGE_CONTENT",
      FILL_FIELDS: "FILL_FIELDS",
    });
  });

  it("validates extension command type guards", () => {
    expect(isExtensionCommandType("SCAN_FIELDS")).toBe(true);
    expect(isExtensionCommandType("READ_PAGE_CONTENT")).toBe(true);
    expect(isExtensionCommandType("NOT_A_COMMAND")).toBe(false);
    expect(isExtensionCommandType(42)).toBe(false);
    expect(isExtensionCommandType(null)).toBe(false);
  });

  it("builds success and error response envelopes", () => {
    const success = ok<{ id: string }, "UNKNOWN">({ id: "field-1" });
    expect(success).toEqual({ ok: true, data: { id: "field-1" } });

    const failure = err<never, "INVALID_REQUEST">("INVALID_REQUEST", "Bad request");
    expect(failure).toEqual({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Bad request",
      },
    });
  });
});
