export const EXTENSION_COMMANDS = {
  SCAN_FIELDS: "SCAN_FIELDS",
  READ_FIELDS: "READ_FIELDS",
  READ_ACTIVE_ELEMENT: "READ_ACTIVE_ELEMENT",
  READ_PAGE_CONTENT: "READ_PAGE_CONTENT",
  FILL_FIELDS: "FILL_FIELDS",
} as const;

export type ExtensionCommandType =
  (typeof EXTENSION_COMMANDS)[keyof typeof EXTENSION_COMMANDS];

export type FillFieldInput = {
  fieldId: string;
  value: string | boolean | string[];
};

export type ScannedFieldKind =
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

export type ScannedField = {
  id: string;
  kind: ScannedFieldKind;
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

export type ReadField = {
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

export type ActiveElement = {
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

export type PageContent = {
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

export type ExtensionPageContent = {
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

export type FillFieldsResult = {
  filled: Array<{
    fieldId: string;
    success: boolean;
    message?: string;
  }>;
};

export type ExtensionRequest =
  | { type: "SCAN_FIELDS"; tabId: number }
  | { type: "READ_FIELDS"; tabId: number }
  | { type: "READ_ACTIVE_ELEMENT"; tabId: number }
  | { type: "READ_PAGE_CONTENT"; tabId: number }
  | { type: "FILL_FIELDS"; tabId: number; payload: FillFieldInput[] };

export type ContentScriptRequest =
  | { type: "SCAN_FIELDS" }
  | { type: "READ_FIELDS" }
  | { type: "READ_ACTIVE_ELEMENT" }
  | { type: "READ_PAGE_CONTENT" }
  | { type: "FILL_FIELDS"; payload: FillFieldInput[] };

export type ExtensionErrorCode =
  | "NO_ACTIVE_TAB"
  | "TAB_NOT_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "UNKNOWN";

export type ContentScriptErrorCode =
  | "UNSUPPORTED_COMMAND"
  | "ELEMENT_NOT_FOUND"
  | "FIELD_NOT_FILLABLE"
  | "INVALID_PAYLOAD"
  | "DOM_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

export type EnvelopeError<TCode extends string> = {
  code: TCode;
  message: string;
};

export type ResponseEnvelope<TData, TCode extends string> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: EnvelopeError<TCode>;
    };

export type ExtensionResponse<TData> = ResponseEnvelope<TData, ExtensionErrorCode>;
export type ContentScriptResponse<TData> = ResponseEnvelope<TData, ContentScriptErrorCode>;

export function isExtensionCommandType(value: unknown): value is ExtensionCommandType {
  return typeof value === "string" && value in EXTENSION_COMMANDS;
}

export function ok<TData, TCode extends string>(data: TData): ResponseEnvelope<TData, TCode> {
  return { ok: true, data };
}

export function err<TData, TCode extends string>(
  code: TCode,
  message: string,
): ResponseEnvelope<TData, TCode> {
  return { ok: false, error: { code, message } };
}
