const EXTENSION_COMMANDS = new Set([
  "SCAN_FIELDS",
  "READ_FIELDS",
  "READ_ACTIVE_ELEMENT",
  "READ_PAGE_CONTENT",
  "FILL_FIELDS",
]);

const CONTENT_ERROR_TO_EXTENSION_ERROR = {
  INVALID_PAYLOAD: "INVALID_REQUEST",
  TIMEOUT: "TIMEOUT",
  DOM_UNAVAILABLE: "CONTENT_SCRIPT_UNAVAILABLE",
  UNSUPPORTED_COMMAND: "INVALID_REQUEST",
};

const CONTENT_SCRIPT_TIMEOUT_MS = 5000;

function ok(data) {
  return { ok: true, data };
}

function error(code, message) {
  return { ok: false, error: { code, message } };
}

function isValidTabId(tabId) {
  return Number.isInteger(tabId) && tabId > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function validateExtensionRequest(request) {
  if (!isObject(request) || typeof request.type !== "string") {
    return "Message must include a valid type.";
  }

  if (!EXTENSION_COMMANDS.has(request.type)) {
    return `Unsupported request type: ${String(request.type)}`;
  }

  if (!isValidTabId(request.tabId)) {
    return "tabId must be a positive integer.";
  }

  if (request.type === "FILL_FIELDS") {
    if (!Array.isArray(request.payload)) {
      return "FILL_FIELDS requires an array payload.";
    }

    const hasInvalidItem = request.payload.some(
      (item) => !isObject(item) || typeof item.fieldId !== "string" || !("value" in item),
    );

    if (hasInvalidItem) {
      return "Each fill payload item must include fieldId and value.";
    }
  }

  return null;
}

function toContentScriptRequest(request) {
  if (request.type === "FILL_FIELDS") {
    return {
      type: "FILL_FIELDS",
      payload: request.payload,
    };
  }

  return {
    type: request.type,
  };
}

async function resolveTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab || null;
  } catch {
    return null;
  }
}

function sendToContentScript(tabId, internalRequest, timeoutMs = CONTENT_SCRIPT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(error("TIMEOUT", `Content script request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, internalRequest, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);

      if (chrome.runtime.lastError) {
        resolve(
          error(
            "CONTENT_SCRIPT_UNAVAILABLE",
            chrome.runtime.lastError.message || "Content script is not available in this tab.",
          ),
        );
        return;
      }

      resolve(response);
    });
  });
}

function normalizeReadPageContent(payload) {
  if (!isObject(payload)) return payload;

  return {
    url: String(payload.url || ""),
    title: String(payload.title || ""),
    headings: Array.isArray(payload.headings) ? payload.headings.map(String) : [],
    sectionHeadings: Array.isArray(payload.sectionHeadings) ? payload.sectionHeadings.map(String) : [],
    visibleText: String(payload.visibleText || ""),
    formContext: isObject(payload.metadata)
      ? {
          platform: typeof payload.metadata.platform === "string" ? payload.metadata.platform : undefined,
          section: typeof payload.metadata.section === "string" ? payload.metadata.section : undefined,
          company: typeof payload.metadata.company === "string" ? payload.metadata.company : undefined,
          jobTitle: typeof payload.metadata.jobTitle === "string" ? payload.metadata.jobTitle : undefined,
        }
      : undefined,
  };
}

function isEnvelope(value) {
  return isObject(value) && typeof value.ok === "boolean";
}

function mapContentErrorToExtension(contentError) {
  if (!isObject(contentError)) {
    return error("UNKNOWN", "Malformed error from content script.");
  }

  const contentCode = typeof contentError.code === "string" ? contentError.code : "UNKNOWN";
  const extensionCode = CONTENT_ERROR_TO_EXTENSION_ERROR[contentCode] || "UNKNOWN";
  const message = typeof contentError.message === "string" ? contentError.message : "Unknown content script error.";

  return error(extensionCode, message);
}

function normalizeSuccessResponse(type, data) {
  if (type === "READ_PAGE_CONTENT") {
    return ok(normalizeReadPageContent(data));
  }

  return ok(data);
}

async function routeExtensionRequest(request) {
  const validationError = validateExtensionRequest(request);
  if (validationError) {
    return error("INVALID_REQUEST", validationError);
  }

  const tab = await resolveTab(request.tabId);
  if (!tab || !isValidTabId(tab.id)) {
    return error("TAB_NOT_FOUND", `Tab ${request.tabId} was not found.`);
  }

  const internalRequest = toContentScriptRequest(request);
  const contentResponse = await sendToContentScript(request.tabId, internalRequest, CONTENT_SCRIPT_TIMEOUT_MS);

  if (!isEnvelope(contentResponse)) {
    if (isObject(contentResponse) && isObject(contentResponse.error)) {
      return mapContentErrorToExtension(contentResponse.error);
    }

    return error("UNKNOWN", "Invalid response envelope from content script.");
  }

  if (!contentResponse.ok) {
    return mapContentErrorToExtension(contentResponse.error);
  }

  return normalizeSuccessResponse(request.type, contentResponse.data);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((caught) => {
      const message = caught instanceof Error ? caught.message : "Failed to initialize side panel behavior.";
      console.error("[background]", message);
    });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  routeExtensionRequest(message)
    .then((response) => sendResponse(response))
    .catch((caught) => {
      const messageText = caught instanceof Error ? caught.message : "Unknown background error.";
      sendResponse(error("UNKNOWN", messageText));
    });

  return true;
});
