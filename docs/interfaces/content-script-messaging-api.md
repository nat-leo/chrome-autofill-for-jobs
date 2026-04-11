# Content Script Messaging API

**Interface:** Service Worker ↔ Content Script
**Transport:** `chrome.tabs.sendMessage`
**Version:** `1.0.0`
**Visibility:** Internal

## Overview

This API defines the internal messaging contract used by the service worker to communicate with the content script running in a specific tab.

The content script owns page interaction and DOM access. The service worker must not perform DOM logic directly. The service worker translates public extension requests into internal content-script commands and normalizes the returned results.

## Responsibilities

### Service Worker

* validates public requests
* resolves target tab
* sends internal message to the content script in that tab
* handles routing and timeout behavior
* returns normalized response envelopes upward

### Content Script

* reads DOM state
* discovers candidate fields
* reads focused element context
* extracts page context
* performs field mutation
* returns normalized results only

## Transport

The service worker sends messages with:

```ts
chrome.tabs.sendMessage(tabId, request)
```

The content script responds with a single stable response envelope.

## Design Rules

* Every request must include a `type`.
* Internal requests do **not** need `tabId`, because tab targeting is already handled by `chrome.tabs.sendMessage`.
* Every response must use the shared `ContentScriptResponse<T>` envelope.
* The content script must return normalized data, not raw DOM nodes.
* The content script must not expose browser-only object references across the boundary.
* The service worker may map internal errors into public extension errors.

---

## Request Envelope

```ts
type ContentScriptRequest =
  | ScanFieldsCommand
  | ReadFieldsCommand
  | ReadActiveElementCommand
  | ReadPageContentCommand
  | FillFieldsCommand;
```

## Response Envelope

```ts
type ContentScriptResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: ContentScriptErrorCode;
        message: string;
      };
    };
```

## Error Codes

```ts
type ContentScriptErrorCode =
  | "UNSUPPORTED_COMMAND"
  | "ELEMENT_NOT_FOUND"
  | "FIELD_NOT_FILLABLE"
  | "INVALID_PAYLOAD"
  | "DOM_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";
```

---

# Operations

## SCAN_FIELDS

**Purpose**
Discover candidate fillable fields on the current page and return normalized field metadata.

**Request**

```ts
type ScanFieldsCommand = {
  type: "SCAN_FIELDS";
};
```

**Success Response**

```ts
type ScanFieldsResult = ContentScriptResponse<ScannedField[]>;
```

**Schema**

```ts
type ScannedField = {
  id: string;
  kind:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "file"
    | "date"
    | "unknown";
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  visible: boolean;
  editable: boolean;
  multiple?: boolean;
  options?: Array<{
    value: string;
    label: string;
  }>;
  confidence: number;
};
```

**Notes**

* `SCAN_FIELDS` is structural discovery.
* It should not be responsible for returning full current field values unless you intentionally choose a combined design.
* Returned `id` values must be stable enough for later `READ_FIELDS` and `FILL_FIELDS` calls in the same page session.

**Example**

```ts
const request: ScanFieldsCommand = {
  type: "SCAN_FIELDS",
};
```

```ts
const response: ScanFieldsResult = {
  ok: true,
  data: [
    {
      id: "first-name",
      kind: "text",
      label: "First Name",
      name: "firstName",
      placeholder: "Enter first name",
      required: true,
      disabled: false,
      readonly: false,
      visible: true,
      editable: true,
      confidence: 0.99,
    },
    {
      id: "country",
      kind: "select",
      label: "Country",
      name: "country",
      required: true,
      disabled: false,
      readonly: false,
      visible: true,
      editable: true,
      options: [
        { value: "US", label: "United States" },
        { value: "CA", label: "Canada" },
      ],
      confidence: 0.95,
    },
  ],
};
```

---

## READ_FIELDS

**Purpose**
Read current values and state of candidate fields on the page.

**Request**

```ts
type ReadFieldsCommand = {
  type: "READ_FIELDS";
};
```

**Success Response**

```ts
type ReadFieldsResult = ContentScriptResponse<ReadField[]>;
```

**Schema**

```ts
type ReadField = {
  id: string;
  kind: string;
  value?: string;
  values?: string[];
  checked?: boolean;
  selectedValues?: string[];
  empty: boolean;
  disabled?: boolean;
  readonly?: boolean;
  visible: boolean;
  validity?: {
    valid: boolean;
    valueMissing?: boolean;
    typeMismatch?: boolean;
    tooLong?: boolean;
    tooShort?: boolean;
    patternMismatch?: boolean;
    customError?: boolean;
  };
};
```

**Notes**

* `READ_FIELDS` is state extraction.
* This should read current DOM state at call time.
* It may operate over the latest live DOM rather than cached scan results.

**Example**

```ts
const request: ReadFieldsCommand = {
  type: "READ_FIELDS",
};
```

```ts
const response: ReadFieldsResult = {
  ok: true,
  data: [
    {
      id: "first-name",
      kind: "text",
      value: "Nate",
      empty: false,
      disabled: false,
      readonly: false,
      visible: true,
      validity: {
        valid: true,
      },
    },
    {
      id: "country",
      kind: "select",
      selectedValues: ["US"],
      empty: false,
      visible: true,
      validity: {
        valid: true,
      },
    },
  ],
};
```

---

## READ_ACTIVE_ELEMENT

**Purpose**
Read normalized information about the currently focused or active interactive element.

**Request**

```ts
type ReadActiveElementCommand = {
  type: "READ_ACTIVE_ELEMENT";
};
```

**Success Response**

```ts
type ReadActiveElementResult = ContentScriptResponse<ActiveElement | null>;
```

**Schema**

```ts
type ActiveElement = {
  id?: string;
  tagName: string;
  kind: string;
  role?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  visible: boolean;
  editable: boolean;
  focused: true;
  describedByText?: string;
  helpText?: string;
  sectionHeading?: string;
};
```

**Notes**

* Returns `null` when no meaningful active element is available.
* This is focused-context, not full-page extraction.

**Example**

```ts
const response: ReadActiveElementResult = {
  ok: true,
  data: {
    id: "cover-letter",
    tagName: "TEXTAREA",
    kind: "textarea",
    label: "Cover Letter",
    name: "coverLetter",
    placeholder: "Enter your cover letter",
    value: "",
    required: false,
    disabled: false,
    readonly: false,
    visible: true,
    editable: true,
    focused: true,
    helpText: "Briefly explain your interest in the role.",
    sectionHeading: "Application Questions",
  },
};
```

---

## READ_PAGE_CONTENT

**Purpose**
Read normalized page-level text and structural context useful for field classification and autofill decisions.

**Request**

```ts
type ReadPageContentCommand = {
  type: "READ_PAGE_CONTENT";
};
```

**Success Response**

```ts
type ReadPageContentResult = ContentScriptResponse<PageContent>;
```

**Schema**

```ts
type PageContent = {
  url: string;
  title: string;
  headings: string[];
  sectionHeadings: string[];
  visibleText: string;
  forms: Array<{
    index: number;
    id?: string;
    name?: string;
    ariaLabel?: string;
    fieldCount: number;
  }>;
  metadata?: {
    platform?: string;
    company?: string;
    jobTitle?: string;
    section?: string;
  };
};
```

**Notes**

* `visibleText` should be normalized and bounded to a reasonable size.
* This payload should be useful for LLM classification and context-aware fill logic.
* Avoid returning the entire raw DOM.

**Example**

```ts
const response: ReadPageContentResult = {
  ok: true,
  data: {
    url: "https://jobs.example.com/apply/123",
    title: "Apply | Backend Engineer",
    headings: ["Apply", "Work Experience", "Application Questions"],
    sectionHeadings: ["Resume", "Experience", "Demographics"],
    visibleText: "Please complete all required fields before submitting your application.",
    forms: [
      {
        index: 0,
        ariaLabel: "Job application form",
        fieldCount: 18,
      },
    ],
    metadata: {
      platform: "Workday",
      company: "Example Corp",
      jobTitle: "Backend Engineer",
      section: "Application Questions",
    },
  },
};
```

---

## FILL_FIELDS

**Purpose**
Fill one or more fields using normalized field identifiers and values.

**Request**

```ts
type FillFieldsCommand = {
  type: "FILL_FIELDS";
  payload: FillFieldInput[];
};
```

**Schema**

```ts
type FillFieldInput = {
  fieldId: string;
  value: string | boolean | string[];
};
```

**Success Response**

```ts
type FillFieldsResult = ContentScriptResponse<{
  filled: Array<{
    fieldId: string;
    success: boolean;
    message?: string;
  }>;
}>;
```

**Notes**

* The content script should dispatch the appropriate DOM events after mutation.
* The content script should gracefully handle missing or stale field identifiers.
* Partial success is valid and should be reported per field.

**Example**

```ts
const request: FillFieldsCommand = {
  type: "FILL_FIELDS",
  payload: [
    { fieldId: "first-name", value: "Nate" },
    { fieldId: "last-name", value: "Liu" },
    { fieldId: "country", value: ["US"] },
    { fieldId: "authorized-to-work", value: true },
  ],
};
```

```ts
const response: FillFieldsResult = {
  ok: true,
  data: {
    filled: [
      { fieldId: "first-name", success: true },
      { fieldId: "last-name", success: true },
      { fieldId: "country", success: true },
      { fieldId: "authorized-to-work", success: true },
    ],
  },
};
```

---

# Common Error Response

```ts
const response: ContentScriptResponse<never> = {
  ok: false,
  error: {
    code: "FIELD_NOT_FILLABLE",
    message: "Field 'resume-upload' cannot be filled programmatically.",
  },
};
```

---

# Mapping Rules to Public Extension API

The service worker may translate internal content-script errors into public extension errors.

Example mapping:

```ts
type ContentScriptToExtensionErrorMap = {
  DOM_UNAVAILABLE: "CONTENT_SCRIPT_UNAVAILABLE";
  TIMEOUT: "TIMEOUT";
  UNKNOWN: "UNKNOWN";
};
```

Suggested mapping rules:

* `UNSUPPORTED_COMMAND` → `INVALID_REQUEST`
* `INVALID_PAYLOAD` → `INVALID_REQUEST`
* `DOM_UNAVAILABLE` → `CONTENT_SCRIPT_UNAVAILABLE`
* `TIMEOUT` → `TIMEOUT`
* `UNKNOWN` → `UNKNOWN`

Errors such as `ELEMENT_NOT_FOUND` and `FIELD_NOT_FILLABLE` may either:

* be preserved as messages inside a successful per-field fill result, or
* be surfaced as `UNKNOWN` / `INVALID_REQUEST` depending on your public API design

Best practice: for `FILL_FIELDS`, prefer **per-field result objects** over hard-failing the entire command.

---

# Versioning Rules

* Additive fields are allowed in response payloads.
* Existing command names and field meanings are stable within a major version.
* New commands are additive.
* Breaking changes require a new major version.
* Stable `fieldId` semantics within a page session are part of the contract.

---

# TypeScript Source of Truth

You should keep one shared file for this internal contract:

```ts
// src/shared/content-script-contract.ts
```

Example:

```ts
export type ContentScriptErrorCode =
  | "UNSUPPORTED_COMMAND"
  | "ELEMENT_NOT_FOUND"
  | "FIELD_NOT_FILLABLE"
  | "INVALID_PAYLOAD"
  | "DOM_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

export type ContentScriptResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ContentScriptErrorCode;
        message: string;
      };
    };

export type ScanFieldsCommand = {
  type: "SCAN_FIELDS";
};

export type ReadFieldsCommand = {
  type: "READ_FIELDS";
};

export type ReadActiveElementCommand = {
  type: "READ_ACTIVE_ELEMENT";
};

export type ReadPageContentCommand = {
  type: "READ_PAGE_CONTENT";
};

export type FillFieldInput = {
  fieldId: string;
  value: string | boolean | string[];
};

export type FillFieldsCommand = {
  type: "FILL_FIELDS";
  payload: FillFieldInput[];
};

export type ContentScriptRequest =
  | ScanFieldsCommand
  | ReadFieldsCommand
  | ReadActiveElementCommand
  | ReadPageContentCommand
  | FillFieldsCommand;
```
