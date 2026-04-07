// content.js

function getFieldInfo(el) {
  if (!(el instanceof HTMLElement)) return null;

  const tag = el.tagName.toLowerCase();
  const type = el instanceof HTMLInputElement ? el.type : null;
  const labelByFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  const labelByParent = el.closest("label");
  const label =
    el.getAttribute("aria-label")?.trim() ||
    labelByFor?.textContent?.trim() ||
    labelByParent?.textContent?.trim() ||
    "";

  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const visible =
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0;

  const disabled =
    "disabled" in el ? Boolean(el.disabled) : el.getAttribute("aria-disabled") === "true";
  const readOnly =
    "readOnly" in el ? Boolean(el.readOnly) : el.getAttribute("aria-readonly") === "true";

  return {
    tag,
    type,
    name: el.getAttribute("name") || "",
    id: el.id || "",
    label,
    value:
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
        ? el.value
        : el.getAttribute("contenteditable") === "true"
          ? el.textContent || ""
          : "",
    placeholder: "placeholder" in el ? el.getAttribute("placeholder") || "" : "",
    visible,
    disabled,
    readOnly,
  };
}

function readAllFields() {
  const fields = [
    ...document.querySelectorAll("input, textarea, select, [contenteditable='true']"),
  ];

  return fields.map(getFieldInfo).filter(Boolean);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SCAN_FIELDS") {
    sendResponse({
      fields: readAllFields(),
      title: document.title,
      url: window.location.href,
    });
    return true;
  }

  if (message?.type === "READ_FIELDS") {
    sendResponse({ fields: readAllFields() });
    return true;
  }

  if (message?.type === "READ_ACTIVE_ELEMENT") {
    sendResponse({ field: getFieldInfo(document.activeElement) });
    return true;
  }

  return false;
});
