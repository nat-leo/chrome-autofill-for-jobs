const SUPPORTED_COMMANDS = new Set([
  "SCAN_FIELDS",
  "READ_FIELDS",
  "READ_ACTIVE_ELEMENT",
  "READ_PAGE_CONTENT",
  "FILL_FIELDS",
]);

const FIELD_ID_ATTRIBUTE = "data-autofill-field-id";
const MAX_VISIBLE_TEXT_LENGTH = 12000;
const SECTION_HEADING_SELECTORS = "h2, h3, h4, legend, [role='heading']";

function ok(data) {
  return { ok: true, data };
}

function error(code, message) {
  return { ok: false, error: { code, message } };
}

function isDomAvailable() {
  return typeof document !== "undefined" && !!document.body;
}

function safeString(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getAllRoots(root = document) {
  const roots = [root];
  const treeWalker = root.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    if (!(node instanceof Element)) continue;

    if (node.shadowRoot) {
      roots.push(...getAllRoots(node.shadowRoot));
    }

    if (node instanceof HTMLIFrameElement) {
      try {
        if (node.contentDocument) {
          roots.push(...getAllRoots(node.contentDocument));
        }
      } catch {
        // Cross-origin iframe is intentionally ignored.
      }
    }
  }

  return roots;
}

function getEditableCandidateElements() {
  if (!isDomAvailable()) return [];

  const selector = [
    "input",
    "textarea",
    "select",
    "[contenteditable='true']",
    "[role='textbox']",
    "[role='searchbox']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='radio']",
    "[role='checkbox']",
  ].join(", ");

  const found = [];
  const seen = new Set();

  for (const root of getAllRoots()) {
    if (!(root instanceof Document || root instanceof ShadowRoot)) continue;

    const nodes = root.querySelectorAll(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (seen.has(node)) continue;
      seen.add(node);
      found.push(node);
    }
  }

  return found;
}

function getElementKind(element) {
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";

  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    if (
      ["text", "email", "tel", "url", "number", "checkbox", "radio", "file", "date"].includes(
        type,
      )
    ) {
      return type;
    }
    return "text";
  }

  const role = (element.getAttribute("role") || "").toLowerCase();
  if (role === "checkbox") return "checkbox";
  if (role === "radio") return "radio";
  if (role === "combobox" || role === "listbox") return "select";
  if (role === "textbox" || role === "searchbox") return "text";

  return "unknown";
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isElementDisabled(element) {
  if ("disabled" in element) return Boolean(element.disabled);
  return element.getAttribute("aria-disabled") === "true";
}

function isElementReadOnly(element) {
  if ("readOnly" in element) return Boolean(element.readOnly);
  return element.getAttribute("aria-readonly") === "true";
}

function isElementEditable(element) {
  return isElementVisible(element) && !isElementDisabled(element) && !isElementReadOnly(element);
}

function getLabelForElement(element) {
  const ariaLabel = safeString(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const texts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((node) => normalizeWhitespace(node.textContent));

    const merged = normalizeWhitespace(texts.join(" "));
    if (merged) return merged;
  }

  if (element.id) {
    const escaped = window.CSS && typeof CSS.escape === "function" ? CSS.escape(element.id) : element.id;
    const byFor = document.querySelector(`label[for="${escaped}"]`);
    const forText = normalizeWhitespace(byFor && byFor.textContent);
    if (forText) return forText;
  }

  const parentLabel = element.closest("label");
  const parentText = normalizeWhitespace(parentLabel && parentLabel.textContent);
  if (parentText) return parentText;

  return undefined;
}

function getSectionHeading(element) {
  const candidates = Array.from(document.querySelectorAll(SECTION_HEADING_SELECTORS));
  if (!candidates.length) return undefined;

  const elementTop = element.getBoundingClientRect().top;
  let bestText;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const heading of candidates) {
    if (!(heading instanceof HTMLElement)) continue;
    const text = normalizeWhitespace(heading.textContent);
    if (!text) continue;

    const top = heading.getBoundingClientRect().top;
    const distance = elementTop - top;
    if (distance >= 0 && distance < bestDistance) {
      bestDistance = distance;
      bestText = text;
    }
  }

  return bestText;
}

function buildStableFieldId(element, index) {
  const existing = element.getAttribute(FIELD_ID_ATTRIBUTE);
  if (existing) return existing;

  const preferredId = safeString(element.id);
  const preferredName = safeString(element.getAttribute("name"));
  const kind = getElementKind(element);

  let generated;
  if (preferredId) {
    generated = `id:${preferredId}`;
  } else if (preferredName) {
    generated = `name:${preferredName}:${index}`;
  } else {
    generated = `field:${kind}:${index}`;
  }

  element.setAttribute(FIELD_ID_ATTRIBUTE, generated);
  return generated;
}

function getElementByFieldId(fieldId) {
  if (!fieldId || !isDomAvailable()) return null;
  const escaped = window.CSS && typeof CSS.escape === "function" ? CSS.escape(fieldId) : fieldId;
  return document.querySelector(`[${FIELD_ID_ATTRIBUTE}="${escaped}"]`);
}

function buildValidity(element) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return undefined;
  }

  const validity = element.validity;
  if (!validity) return undefined;

  return {
    valid: validity.valid,
    valueMissing: validity.valueMissing || undefined,
    typeMismatch: validity.typeMismatch || undefined,
    tooLong: validity.tooLong || undefined,
    tooShort: validity.tooShort || undefined,
    patternMismatch: validity.patternMismatch || undefined,
    customError: validity.customError || undefined,
  };
}

function readElementValue(element) {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return { checked: Boolean(element.checked), empty: !element.checked };
    }
    return {
      value: element.value,
      empty: element.value.length === 0,
    };
  }

  if (element instanceof HTMLTextAreaElement) {
    return { value: element.value, empty: element.value.length === 0 };
  }

  if (element instanceof HTMLSelectElement) {
    const selectedValues = Array.from(element.selectedOptions).map((opt) => opt.value);
    return {
      selectedValues,
      empty: selectedValues.length === 0 || selectedValues.every((value) => value === ""),
    };
  }

  if (element.getAttribute("contenteditable") === "true") {
    const value = normalizeWhitespace(element.textContent);
    return { value, empty: value.length === 0 };
  }

  return { empty: true };
}

function normalizeScannedField(element, index) {
  const id = buildStableFieldId(element, index);
  const kind = getElementKind(element);
  const label = getLabelForElement(element);
  const name = safeString(element.getAttribute("name"));
  const placeholder = "placeholder" in element ? safeString(element.getAttribute("placeholder")) : undefined;
  const required = "required" in element ? Boolean(element.required) : element.getAttribute("aria-required") === "true";
  const disabled = isElementDisabled(element);
  const readonly = isElementReadOnly(element);
  const visible = isElementVisible(element);
  const editable = isElementEditable(element);

  const field = {
    id,
    kind,
    label,
    name,
    placeholder,
    required: required || undefined,
    disabled,
    readonly,
    visible,
    editable,
    confidence: editable ? 0.95 : 0.8,
  };

  if (element instanceof HTMLSelectElement) {
    field.multiple = element.multiple;
    field.options = Array.from(element.options).map((option) => ({
      value: option.value,
      label: normalizeWhitespace(option.label || option.textContent || option.value),
    }));
  }

  return field;
}

function normalizeReadField(element, index) {
  const id = buildStableFieldId(element, index);
  const kind = getElementKind(element);
  const values = readElementValue(element);

  return {
    id,
    kind,
    ...values,
    disabled: isElementDisabled(element),
    readonly: isElementReadOnly(element),
    visible: isElementVisible(element),
    validity: buildValidity(element),
  };
}

function readDescribedByText(element) {
  const describedBy = element.getAttribute("aria-describedby");
  if (!describedBy) return undefined;

  const text = describedBy
    .split(/\s+/)
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .map((node) => normalizeWhitespace(node.textContent))
    .join(" ");

  const normalized = normalizeWhitespace(text);
  return normalized || undefined;
}

function readActiveElement() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }

  if (active === document.body || active === document.documentElement) {
    return null;
  }

  const candidates = getEditableCandidateElements();
  const index = Math.max(candidates.indexOf(active), 0);

  const id = buildStableFieldId(active, index);
  const kind = getElementKind(active);

  return {
    id,
    tagName: active.tagName,
    kind,
    role: safeString(active.getAttribute("role")),
    label: getLabelForElement(active),
    name: safeString(active.getAttribute("name")),
    placeholder: "placeholder" in active ? safeString(active.getAttribute("placeholder")) : undefined,
    value:
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement
        ? active.value
        : normalizeWhitespace(active.textContent),
    required: "required" in active ? Boolean(active.required) : active.getAttribute("aria-required") === "true" || undefined,
    disabled: isElementDisabled(active),
    readonly: isElementReadOnly(active),
    visible: isElementVisible(active),
    editable: isElementEditable(active),
    focused: true,
    describedByText: readDescribedByText(active),
    helpText: safeString(active.getAttribute("aria-description")),
    sectionHeading: getSectionHeading(active),
  };
}

function readPageContent() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((heading) => normalizeWhitespace(heading.textContent))
    .filter(Boolean)
    .slice(0, 40);

  const sectionHeadings = Array.from(document.querySelectorAll(SECTION_HEADING_SELECTORS))
    .map((heading) => normalizeWhitespace(heading.textContent))
    .filter(Boolean)
    .slice(0, 60);

  const visibleText = normalizeWhitespace(document.body ? document.body.innerText : "").slice(0, MAX_VISIBLE_TEXT_LENGTH);

  const forms = Array.from(document.querySelectorAll("form")).map((form, index) => ({
    index,
    id: safeString(form.id),
    name: safeString(form.getAttribute("name")),
    ariaLabel: safeString(form.getAttribute("aria-label")),
    fieldCount: form.querySelectorAll("input, textarea, select").length,
  }));

  return {
    url: window.location.href,
    title: document.title,
    headings,
    sectionHeadings,
    visibleText,
    forms,
    metadata: inferPageMetadata(),
  };
}

function inferPageMetadata() {
  const textBlob = `${document.title} ${document.body ? document.body.innerText : ""}`.toLowerCase();
  const platformMatchers = [
    ["workday", "Workday"],
    ["greenhouse", "Greenhouse"],
    ["lever", "Lever"],
    ["ashby", "Ashby"],
  ];

  let platform;
  for (const [needle, value] of platformMatchers) {
    if (textBlob.includes(needle)) {
      platform = value;
      break;
    }
  }

  const section = normalizeWhitespace(
    document.querySelector("h1, h2, legend, [aria-current='step']")?.textContent || "",
  );

  return {
    platform,
    section: section || undefined,
  };
}

function dispatchMutationEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setElementValue(element, value) {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();

    if (type === "file") {
      return { success: false, message: "File inputs are not fillable by script." };
    }

    if (type === "checkbox") {
      if (typeof value !== "boolean") {
        return { success: false, message: "Checkbox value must be boolean." };
      }

      element.checked = value;
      dispatchMutationEvents(element);
      return { success: true };
    }

    if (type === "radio") {
      if (typeof value !== "boolean" && typeof value !== "string") {
        return { success: false, message: "Radio value must be boolean or string." };
      }

      if (typeof value === "boolean") {
        element.checked = value;
      } else {
        element.checked = element.value === value;
      }

      dispatchMutationEvents(element);
      return { success: true };
    }

    if (typeof value !== "string") {
      return { success: false, message: "Input value must be a string." };
    }

    element.focus();
    element.value = value;
    dispatchMutationEvents(element);
    return { success: true };
  }

  if (element instanceof HTMLTextAreaElement) {
    if (typeof value !== "string") {
      return { success: false, message: "Textarea value must be a string." };
    }

    element.focus();
    element.value = value;
    dispatchMutationEvents(element);
    return { success: true };
  }

  if (element instanceof HTMLSelectElement) {
    const values = Array.isArray(value) ? value.map(String) : [String(value)];

    if (element.multiple) {
      const valueSet = new Set(values);
      for (const option of element.options) {
        option.selected = valueSet.has(option.value);
      }
    } else {
      const chosen = values[0] ?? "";
      const direct = Array.from(element.options).find((option) => option.value === chosen);
      if (direct) {
        element.value = direct.value;
      } else {
        const byLabel = Array.from(element.options).find(
          (option) => normalizeWhitespace(option.label || option.textContent) === normalizeWhitespace(chosen),
        );
        if (byLabel) {
          element.value = byLabel.value;
        } else {
          return { success: false, message: "No matching select option found." };
        }
      }
    }

    dispatchMutationEvents(element);
    return { success: true };
  }

  if (element.getAttribute("contenteditable") === "true") {
    if (typeof value !== "string") {
      return { success: false, message: "Contenteditable value must be a string." };
    }

    element.focus();
    element.textContent = value;
    dispatchMutationEvents(element);
    return { success: true };
  }

  return { success: false, message: "Element is not fillable." };
}

function scanFieldsHandler() {
  const fields = getEditableCandidateElements().map((element, index) => normalizeScannedField(element, index));
  return ok(fields);
}

function readFieldsHandler() {
  const fields = getEditableCandidateElements().map((element, index) => normalizeReadField(element, index));
  return ok(fields);
}

function readActiveElementHandler() {
  return ok(readActiveElement());
}

function readPageContentHandler() {
  return ok(readPageContent());
}

function fillFieldsHandler(payload) {
  if (!Array.isArray(payload)) {
    return error("INVALID_PAYLOAD", "FILL_FIELDS requires an array payload.");
  }

  const filled = payload.map((item) => {
    if (!item || typeof item.fieldId !== "string") {
      return {
        fieldId: item && typeof item.fieldId === "string" ? item.fieldId : "",
        success: false,
        message: "Invalid fill instruction.",
      };
    }

    const element = getElementByFieldId(item.fieldId);
    if (!(element instanceof HTMLElement)) {
      return {
        fieldId: item.fieldId,
        success: false,
        message: "ELEMENT_NOT_FOUND",
      };
    }

    if (!isElementEditable(element)) {
      return {
        fieldId: item.fieldId,
        success: false,
        message: "FIELD_NOT_FILLABLE",
      };
    }

    const result = setElementValue(element, item.value);
    return {
      fieldId: item.fieldId,
      success: result.success,
      message: result.message,
    };
  });

  return ok({ filled });
}

function handleCommand(message) {
  if (!isDomAvailable()) {
    return error("DOM_UNAVAILABLE", "Document is not available.");
  }

  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    return error("INVALID_PAYLOAD", "Message must include a valid type.");
  }

  if (!SUPPORTED_COMMANDS.has(message.type)) {
    return error("UNSUPPORTED_COMMAND", `Unsupported command: ${String(message.type)}`);
  }

  if (message.type === "SCAN_FIELDS") return scanFieldsHandler();
  if (message.type === "READ_FIELDS") return readFieldsHandler();
  if (message.type === "READ_ACTIVE_ELEMENT") return readActiveElementHandler();
  if (message.type === "READ_PAGE_CONTENT") return readPageContentHandler();
  if (message.type === "FILL_FIELDS") return fillFieldsHandler(message.payload);

  return error("UNSUPPORTED_COMMAND", `Unsupported command: ${String(message.type)}`);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  Promise.resolve()
    .then(() => handleCommand(message))
    .then((response) => sendResponse(response))
    .catch((caught) => {
      const messageText = caught instanceof Error ? caught.message : "Unknown content script error.";
      sendResponse(error("UNKNOWN", messageText));
    });

  return true;
});
