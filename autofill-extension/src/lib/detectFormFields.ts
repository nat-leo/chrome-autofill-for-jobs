export type DetectedFormField = {
  type: string;
  label?: string;
  name?: string;
  required?: boolean;
};

const INPUT_SELECTOR = "input, textarea, select, [contenteditable='true']";
const SKIPPED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

function cleanText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\s*\*+\s*/g, " ").replace(/\s+/g, " ").trim();
}

function getFieldType(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  return (element.getAttribute("type") || "text").toLowerCase();
}

function isVisible(element: HTMLElement) {
  if (element.hidden) return false;
  if (element.closest("[hidden], [aria-hidden='true']")) return false;

  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden") {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function findExplicitLabel(root: ParentNode, id: string) {
  if (!id) return "";

  const labels = Array.from(root.querySelectorAll("label[for]"));
  const matching = labels.find((label) => label.getAttribute("for") === id);
  return cleanText(matching?.textContent);
}

function getFieldLabel(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  root: ParentNode,
) {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const explicitLabel = findExplicitLabel(root, element.id);
  if (explicitLabel) return explicitLabel;

  const wrappingLabel = cleanText(element.closest("label")?.textContent);
  if (wrappingLabel) return wrappingLabel;

  const placeholder = cleanText(element.getAttribute("placeholder"));
  if (placeholder) return placeholder;

  return cleanText(element.getAttribute("name"));
}

function isSupportedField(
  node: Element,
): node is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement
  );
}

function isSkippableInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (!(element instanceof HTMLInputElement)) return false;
  return SKIPPED_INPUT_TYPES.has((element.type || "text").toLowerCase());
}

export function detectFormFields(root: ParentNode = document): DetectedFormField[] {
  return Array.from(root.querySelectorAll(INPUT_SELECTOR))
    .filter(isSupportedField)
    .filter((field) => !isSkippableInput(field))
    .filter((field) => isVisible(field))
    .map((field) => ({
      type: getFieldType(field),
      label: getFieldLabel(field, root),
      name: field.getAttribute("name") || field.id || "",
      required:
        field.required ||
        cleanText(field.getAttribute("aria-required")).toLowerCase() === "true",
    }));
}
