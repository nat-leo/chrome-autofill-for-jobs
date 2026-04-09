// content.js

function getEditableFieldElements() {
  return [...document.querySelectorAll(`
    input,
    textarea,
    select,
    [contenteditable="true"],
    [role="textbox"],
    [role="searchbox"],
    [role="combobox"],
    [role="listbox"],
    [role="radio"],
    [role="checkbox"],
    [role="switch"],
    [role="slider"],
    [role="spinbutton"]
  `)];
}

function getFieldInfo(el, domIndex) {
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
    domIndex,
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
  const fields = getEditableFieldElements();

  return fields
    .map((el, domIndex) => getFieldInfo(el, domIndex))
    .filter(Boolean);
}

function dispatchValueEvents(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function asBoolean(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function setElementValue(el, value) {
  if (!(el instanceof HTMLElement)) return false;

  if (el instanceof HTMLInputElement) {
    const inputType = el.type.toLowerCase();

    if (inputType === "file") {
      return false;
    }

    if (inputType === "checkbox") {
      el.checked = asBoolean(value);
      dispatchValueEvents(el);
      return true;
    }

    if (inputType === "radio") {
      el.checked = String(el.value) === String(value);
      dispatchValueEvents(el);
      return true;
    }

    el.focus();
    el.value = value;
    dispatchValueEvents(el);
    return true;
  }

  if (el instanceof HTMLTextAreaElement) {
    el.focus();
    el.value = value;
    dispatchValueEvents(el);
    return true;
  }

  if (el instanceof HTMLSelectElement) {
    const options = [...el.options];
    const optionByValue = options.find((option) => option.value === value);
    const optionByLabel = options.find((option) => option.text.trim() === value.trim());

    if (optionByValue) {
      el.value = optionByValue.value;
    } else if (optionByLabel) {
      el.value = optionByLabel.value;
    } else {
      el.value = value;
    }

    dispatchValueEvents(el);
    return true;
  }

  if (el.getAttribute("contenteditable") === "true") {
    el.focus();
    el.textContent = value;
    dispatchValueEvents(el);
    return true;
  }

  return false;
}

function fillFields(fields) {
  if (!Array.isArray(fields)) {
    return {
      updated: 0,
      total: 0,
      error: "Invalid fields payload.",
    };
  }

  const editableFields = getEditableFieldElements();
  let updated = 0;

  for (const item of fields) {
    if (!item || typeof item.domIndex !== "number") continue;

    const targetEl = editableFields[item.domIndex];
    if (!targetEl) continue;

    const value = item.value == null ? "" : String(item.value);
    if (setElementValue(targetEl, value)) {
      updated += 1;
    }
  }

  return {
    updated,
    total: fields.length,
  };
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
    sendResponse({ field: getFieldInfo(document.activeElement, -1) });
    return true;
  }

  if (message?.type === "READ_PAGE_CONTENT") {
    sendResponse({
      title: document.title,
      url: window.location.href,
      text: document.body?.innerText ?? "",
    });
    return true;
  }

  if (message?.type === "FILL_FIELDS") {
    sendResponse(fillFields(message.fields));
    return true;
  }

  return false;
});
