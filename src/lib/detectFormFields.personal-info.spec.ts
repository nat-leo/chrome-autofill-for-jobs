import { beforeEach, describe, expect, it } from "vitest";
import { detectFormFields } from "@/lib/detectFormFields";

describe("form detection - personal information form", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <section aria-label="Personal information">
          <h1>Personal information</h1>
          <p>Fields marked with * are required.</p>

          <button type="button" aria-label="Edit profile photo">
            Edit
          </button>

          <form aria-label="Personal information form">
            <div>
              <label for="firstName">First name*</label>
              <input id="firstName" name="firstName" type="text" required />
              <div role="alert">Value is required</div>
            </div>

            <div>
              <label for="lastName">Last name*</label>
              <input id="lastName" name="lastName" type="text" required />
              <div role="alert">Value is required</div>
            </div>

            <div>
              <label for="email">Email*</label>
              <input id="email" name="email" type="email" required />
            </div>

            <div>
              <label for="confirmEmail">Confirm your email*</label>
              <input id="confirmEmail" name="confirmEmail" type="email" required />
            </div>

            <div>
              <label for="city">City</label>
              <input id="city" name="city" type="text" />
              <button type="button" aria-label="Search city">Search</button>
            </div>

            <fieldset>
              <legend>Phone number*</legend>

              <label for="countryCode" class="sr-only">Country code</label>
              <select id="countryCode" name="countryCode" required>
                <option value="+1">United States (+1)</option>
              </select>

              <label for="phoneNumber" class="sr-only">Phone number</label>
              <input id="phoneNumber" name="phoneNumber" type="tel" required />
            </fieldset>
          </form>
        </section>

        <section aria-label="Experience">
          <h2>Experience</h2>
          <button type="button">Add</button>
        </section>
      </main>
    `;

    const visibleRect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 20,
      width: 100,
      height: 20,
      toJSON: () => ({}),
    } as DOMRect;

    const editableFields = document.querySelectorAll(
      "input, textarea, select, [contenteditable='true']",
    );
    for (const field of editableFields) {
      Object.defineProperty(field, "getBoundingClientRect", {
        configurable: true,
        value: () => visibleRect,
      });
    }
  });

  it("detects all visible form fields from the screenshot", () => {
    const fields = detectFormFields(document);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          label: "First name",
          name: "firstName",
          required: true,
        }),
        expect.objectContaining({
          type: "text",
          label: "Last name",
          name: "lastName",
          required: true,
        }),
        expect.objectContaining({
          type: "email",
          label: "Email",
          name: "email",
          required: true,
        }),
        expect.objectContaining({
          type: "email",
          label: "Confirm your email",
          name: "confirmEmail",
          required: true,
        }),
        expect.objectContaining({
          type: "text",
          label: "City",
          name: "city",
          required: false,
        }),
        expect.objectContaining({
          type: "select",
          label: "Phone number",
          name: "countryCode",
          required: true,
        }),
        expect.objectContaining({
          type: "tel",
          label: "Phone number",
          name: "phoneNumber",
          required: true,
        }),
      ]),
    );

    expect(fields).toHaveLength(7);
  });

  it("does not mistake non-field controls for form inputs", () => {
    const fields = detectFormFields(document);

    expect(fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Edit profile photo" }),
        expect.objectContaining({ label: "Search city" }),
        expect.objectContaining({ label: "Add" }),
      ]),
    );
  });

  it("preserves required vs optional correctly", () => {
    const fields = detectFormFields(document);
    const byName = Object.fromEntries(fields.map((field) => [field.name, field]));

    expect(byName.firstName.required).toBe(true);
    expect(byName.lastName.required).toBe(true);
    expect(byName.email.required).toBe(true);
    expect(byName.confirmEmail.required).toBe(true);
    expect(byName.city.required).toBe(false);
    expect(byName.countryCode.required).toBe(true);
    expect(byName.phoneNumber.required).toBe(true);
  });
});
