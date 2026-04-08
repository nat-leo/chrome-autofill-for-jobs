import { beforeEach, describe, expect, it } from "vitest";
import { detectFormFields } from "@/lib/detectFormFields";

function forceVisibleEditableRects(root: ParentNode = document) {
  const visibleRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 120,
    bottom: 24,
    width: 120,
    height: 24,
    toJSON: () => ({}),
  } as DOMRect;

  const editable = root.querySelectorAll("input, textarea, select, [contenteditable='true']");
  for (const el of editable) {
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => visibleRect,
    });
  }
}

describe("detectFormFields web-inspired adversarial cases", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("fails on aria-labelledby-only labeling patterns used in accessibility guidance", () => {
    document.body.innerHTML = `
      <form aria-label="identity">
        <span id="dob-label">Date of birth</span>
        <span id="dob-format">MM / DD / YYYY</span>
        <input
          id="dob"
          name="dateOfBirth"
          type="text"
          aria-labelledby="dob-label dob-format"
          required
        />
      </form>
    `;
    forceVisibleEditableRects();

    const fields = detectFormFields(document);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          name: "dateOfBirth",
          label: "Date of birth MM / DD / YYYY",
          required: true,
        }),
      ]),
    );
  });

  it("fails to ignore offscreen honeypot traps often used in embedded newsletter forms", () => {
    document.body.innerHTML = `
      <form aria-label="newsletter">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />

        <div style="position:absolute; left:-10000px; top:auto; width:1px; height:1px; overflow:hidden;">
          <label for="company">Company</label>
          <input id="company" name="company" type="text" tabindex="-1" autocomplete="off" />
        </div>
      </form>
    `;
    forceVisibleEditableRects();

    const fields = detectFormFields(document);
    const fieldNames = fields.map((field) => field.name);

    expect(fieldNames).toEqual(["email"]);
  });

  it("fails to detect select-only ARIA combobox widgets that are not native select/input", () => {
    document.body.innerHTML = `
      <form aria-label="travel preferences">
        <label id="airport-label">Preferred airport</label>
        <div
          id="airport-combobox"
          role="combobox"
          aria-labelledby="airport-label"
          aria-controls="airport-list"
          aria-expanded="false"
          data-name="preferredAirport"
        ></div>
        <div id="airport-list" role="listbox">
          <div role="option">SFO</div>
          <div role="option">LAX</div>
        </div>
      </form>
    `;

    const fields = detectFormFields(document);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "combobox",
          name: "preferredAirport",
          label: "Preferred airport",
        }),
      ]),
    );
  });

  it("fails to carry fieldset legend context into grouped address labels", () => {
    document.body.innerHTML = `
      <form aria-label="gov-style address form">
        <fieldset>
          <legend>What is your address?</legend>

          <label for="address-line-1">Address line 1</label>
          <input id="address-line-1" name="addressLine1" type="text" required />

          <label for="address-line-2">Address line 2 (optional)</label>
          <input id="address-line-2" name="addressLine2" type="text" />
        </fieldset>
      </form>
    `;
    forceVisibleEditableRects();

    const fields = detectFormFields(document);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          name: "addressLine1",
          label: "What is your address? Address line 1",
          required: true,
        }),
        expect.objectContaining({
          type: "text",
          name: "addressLine2",
          label: "What is your address? Address line 2",
          required: false,
        }),
      ]),
    );
  });
});
