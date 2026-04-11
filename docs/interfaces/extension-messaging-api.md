# Extension Messaging API

**Interface:** Sidebar UI ↔ Service Worker
**Transport:** `chrome.runtime.sendMessage`
**Version:** `1.0.0`

## Overview

This API defines the public messaging contract that the extension UI may use to communicate with the service worker.

The service worker is the only public backend for the UI. The UI does not communicate directly with content-script DOM logic.

## Transport

The UI sends messages with:

```ts
chrome.runtime.sendMessage(request)
```

The service worker responds with a single stable response envelope.

## Design Rules

* Every request must include a `type`.
* Every page-targeted request must include a `tabId`.
* Every response must use the shared `ExtensionResponse<T>` envelope.
* The service worker owns validation, routing, and normalization.
* The UI must not send raw DOM instructions.

## Request Envelope

```ts
type ExtensionRequest =
  | ScanFieldsRequest
  | ReadFieldsRequest
  | ReadActiveElementRequest
  | ReadPageContentRequest
  | FillFieldsRequest;
```

## Response Envelope

```ts
type ExtensionResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: ExtensionErrorCode;
        message: string;
      };
    };
```

## Error Codes

```ts
type ExtensionErrorCode =
  | "NO_ACTIVE_TAB"
  | "TAB_NOT_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "UNKNOWN";
```

## Operations

### SCAN_FIELDS

**Purpose**
Discover candidate fillable fields on the page.

**Request**

```ts
type ScanFieldsRequest = {
  type: "SCAN_FIELDS";
  tabId: number;
};
```

**Success Response**

```ts
type ScanFieldsResponse = ExtensionResponse<ScannedField[]>;
```

**Schema**

```ts
type ScannedField = {
  id: string;
  kind: "text" | "email" | "tel" | "textarea" | "select" | "checkbox" | "radio" | "file" | "unknown";
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  visible: boolean;
  editable: boolean;
  confidence: number;
};
```

**Example**

```ts
const request: ScanFieldsRequest = {
  type: "SCAN_FIELDS",
  tabId: 123,
};
```

```ts
const response: ScanFieldsResponse = {
  ok: true,
  data: [
    {
      id: "email",
      kind: "email",
      label: "Email",
      name: "email",
      placeholder: "name@example.com",
      required: true,
      visible: true,
      editable: true,
      confidence: 0.98,
    },
  ],
};
```

---

### READ_FIELDS

**Purpose**
Read current values and state for detected fields.

**Request**

```ts
type ReadFieldsRequest = {
  type: "READ_FIELDS";
  tabId: number;
};
```

**Success Response**

```ts
type ReadFieldsResponse = ExtensionResponse<ReadField[]>;
```

**Schema**

```ts
type ReadField = {
  id: string;
  value?: string;
  checked?: boolean;
  selectedValues?: string[];
  empty: boolean;
};
```

**Example**

```ts
const request: ReadFieldsRequest = {
  type: "READ_FIELDS",
  tabId: 123,
};
```

```ts
const response: ReadFieldsResponse = {
  ok: true,
  data: [
    {
      id: "email",
      value: "nate@example.com",
      empty: false,
    },
  ],
};
```

---

### READ_ACTIVE_ELEMENT

**Purpose**
Read the currently focused field or interactive element.

**Request**

```ts
type ReadActiveElementRequest = {
  type: "READ_ACTIVE_ELEMENT";
  tabId: number;
};
```

**Success Response**

```ts
type ReadActiveElementResponse = ExtensionResponse<ActiveElement | null>;
```

**Schema**

```ts
type ActiveElement = {
  id?: string;
  kind: string;
  label?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  visible: boolean;
};
```

**Example**

```ts
const response: ReadActiveElementResponse = {
  ok: true,
  data: {
    id: "cover-letter",
    kind: "textarea",
    label: "Cover Letter",
    value: "",
    required: false,
    disabled: false,
    readonly: false,
    visible: true,
  },
};
```

---

### READ_PAGE_CONTENT

**Purpose**
Read normalized page-level context useful for classification and autofill decisions.

**Request**

```ts
type ReadPageContentRequest = {
  type: "READ_PAGE_CONTENT";
  tabId: number;
};
```

**Success Response**

```ts
type ReadPageContentResponse = ExtensionResponse<PageContent>;
```

**Schema**

```ts
type PageContent = {
  url: string;
  title: string;
  headings: string[];
  sectionHeadings: string[];
  visibleText: string;
  formContext?: {
    platform?: string;
    section?: string;
    company?: string;
    jobTitle?: string;
  };
};
```

**Example**

```ts
const response: ReadPageContentResponse = {
  ok: true,
  data: {
    url: "https://jobs.example.com/apply/123",
    title: "Apply | Backend Engineer",
    headings: ["Apply", "Work Experience", "Voluntary Self Identification"],
    sectionHeadings: ["Experience", "Resume", "Demographics"],
    visibleText: "Please complete all required fields...",
    formContext: {
      platform: "Workday",
      section: "Experience",
      company: "Example Corp",
      jobTitle: "Backend Engineer",
    },
  },
};
```

---

### FILL_FIELDS

**Purpose**
Fill one or more fields with normalized values.

**Request**

```ts
type FillFieldsRequest = {
  type: "FILL_FIELDS";
  tabId: number;
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
type FillFieldsResponse = ExtensionResponse<FillFieldsResult>;
```

```ts
type FillFieldsResult = {
  filled: Array<{
    fieldId: string;
    success: boolean;
    message?: string;
  }>;
};
```

**Example**

```ts
const request: FillFieldsRequest = {
  type: "FILL_FIELDS",
  tabId: 123,
  payload: [
    { fieldId: "first-name", value: "Nate" },
    { fieldId: "last-name", value: "Liu" },
    { fieldId: "email", value: "nate@example.com" },
  ],
};
```

```ts
const response: FillFieldsResponse = {
  ok: true,
  data: {
    filled: [
      { fieldId: "first-name", success: true },
      { fieldId: "last-name", success: true },
      { fieldId: "email", success: true },
    ],
  },
};
```

## Common Error Response

```ts
const response: ExtensionResponse<never> = {
  ok: false,
  error: {
    code: "CONTENT_SCRIPT_UNAVAILABLE",
    message: "Content script is not available in this tab.",
  },
};
```

## Versioning Rules

* Additive fields are allowed in response payloads.
* Existing field names and meanings are stable within a major version.
* New message types are additive.
* Breaking changes require a new major version.

## TypeScript Source of Truth

You should keep one shared file like:

```ts
// src/shared/extension-contract.ts
```

and put every request/response/schema type there. The docs should be generated from, or at least manually kept aligned with, that file.

## The actual “standard” answer

If you want the shortest honest answer:

* **HTTP APIs:** OpenAPI is the standard. ([OpenAPI Initiative][1])
* **Event/message APIs:** AsyncAPI is the closest standard. ([AsyncAPI][2])
* **Chrome extension UI ↔ service worker:** use an **API reference modeled after OpenAPI/AsyncAPI**, but your real source of truth should be **TypeScript contract types + tests**.

For your extension, I would document it as a **Messaging API Reference** rather than pretending it is REST.

If you want, I can turn this into a polished `EXTENSION_API.md` file in production-quality style.

[1]: https://www.openapis.org/?utm_source=chatgpt.com "OpenAPI Initiative – The OpenAPI Initiative provides an open ..."
[2]: https://www.asyncapi.com/en?utm_source=chatgpt.com "AsyncAPI Initiative for event-driven APIs | AsyncAPI Initiative ..."
