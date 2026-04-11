# Public Beta MVP Rollout Plan for `autofill-extension`

## Summary

The current repo proves the extension shell works, but it is not yet an MVP for potential customers. Today the product is a side-panel form inspector with manual fill assistance: it opens from the Chrome action, scans the active tab for editable controls, lists raw field metadata, lets the user edit values in the panel, and writes those values back into the page. It also already reaches shadow DOM and same-origin iframes.

What is missing for a customer-facing MVP is the actual product promise from `spec.md`: canonical profile storage, semantic field classification, confidence-based autofill, full resume/demographics support, iframe-aware routing for embedded ATS flows, reliability safeguards, and proof that it works across the target ATS families. `npm run build` and `npm run lint` pass, but automated validation is not customer-ready: the Vitest suite is broken because `src/test/setup.ts` is missing, and the Playwright coverage only verifies that the extension loads.

## Current Shipped Capabilities

- Chrome MV3 extension with side panel and background worker.
- Active-tab scan of editable elements across the page, shadow roots, and same-origin iframes.
- Manual review/edit of detected field values in the side panel.
- Manual “fill webpage form” action for text inputs, textareas, selects, radios, checkboxes, and contenteditable fields.
- Basic error and success notices in the UI.
- No persisted user profile, no semantic mapping, no fill safety policy, no audit log, no file upload support, and no meaningful compatibility claims yet.

## Rollout Plan

### Phase 0: Stabilize the extension shell and trust baseline

- Rebrand the manifest, extension name, description, icons, and popup so nothing customer-facing still says “Hello Extensions” or looks like a scaffold.
- Move the background worker from “open side panel only” to the real coordinator for permissions, frame-aware script injection, tab targeting, and message routing.
- Replace fragile `domIndex` targeting with stable field identity: `fieldId`, `frameId`, `selectorHint`, `fieldType`, `confidence`, and `fillState`.
- Stop relying on blanket passive scanning as the product story; switch to user-triggered scanning/filling and document the permission model for Chrome Web Store review.
- Fix the automated test layout before feature work continues so the repo has a trustworthy regression harness.

### Phase 1: Build the canonical profile and local data layer

- Add a customer-visible profile editor for first name, last name, preferred name, email, phone, LinkedIn, GitHub, personal site, cover letter, resume file, and U.S. demographic answers.
- Store structured profile/settings in `chrome.storage.local` and store the resume blob plus metadata in IndexedDB; include schema versioning and migration handling.
- Add explicit defaults: overwrite disabled by default, local-only storage, manual review before fill, and no form submission.
- Add import/export for the profile so users can back up and restore data without a backend.

### Phase 2: Build the detection and classification engine

- Introduce a real `SupportedFieldType` taxonomy covering core profile fields, resume upload, and the demographic categories in the spec.
- Expand extraction beyond raw labels to include `aria-labelledby`, nearby text, section headings, group legends, select option text, DOM ancestry, and page/iframe context.
- Add a rules-based classifier with confidence scoring and explicit “unsupported” / “needs review” states.
- Make scanning frame-aware for embedded ATS flows, including same-tab iframe applications like SmartRecruiters one-click; each detected field must carry `frameId` and site-family context.
- Add site adapters for Greenhouse, Lever, Workday, Ashby, SmartRecruiters embedded flows, plus a generic fallback classifier for ordinary HTML forms.
- Surface classification results in the side panel so the user sees detected field type, confidence, reason, and whether the field will be autofilled or skipped.

### Phase 3: Harden fill behavior into a real autofill product

- Fill only high-confidence fields by default; let the user opt into low-confidence or manually corrected fields.
- Add per-field fill outcomes: `filled`, `skipped_existing_value`, `skipped_low_confidence`, `blocked`, `unsupported`, and `failed`.
- Enforce the non-overwrite rule unless the user explicitly enables overwrite for that run.
- Add type-specific handlers for selects, radio groups, checkbox groups, combobox-like widgets, contenteditable controls, and resume file upload.
- Implement post-fill verification plus re-scan after SPA rerenders so the UI reflects the actual page state, not just the attempted action.
- Add page-state UX needed for a public beta: supported-site summary, iframe/permission blockers, “refresh after next step,” and clear privacy copy.

### Phase 4: Public beta release readiness

- Package the extension for Chrome Web Store distribution, including store assets, branding, support copy, privacy policy, and permission justification.
- Replace the current generic README with customer/admin docs: install flow, supported ATS families, known limitations, and what “broad job sites” means in practice.
- Run an internal dogfood pass first, then a small closed beta, and only then open the Chrome Web Store public beta.
- Define the public claim narrowly and truthfully: support major ATS families and embedded application flows that are covered by the shipped adapters and test corpus; do not market it as universal across every career site.

## Important Interface and Type Changes

- Add `UserProfile`, `ProfileSettings`, `ResumeAsset`, `DetectedField`, `SiteContext`, `FillDecision`, and `FillResult` types.
- Replace raw scan payloads with classified fields that include `fieldId`, `frameId`, `fieldType`, `confidence`, `currentValue`, `suggestedValue`, `isFillable`, and `reason`.
- Add message contracts for `GET_PROFILE`, `SAVE_PROFILE`, `SCAN_APPLICATION`, `FILL_SELECTED_FIELDS`, `UPLOAD_RESUME`, and `GET_FILL_LOG`.
- Add a site-family detector so the UI and fill engine can branch on `generic`, `greenhouse`, `lever`, `workday`, `ashby`, or `smartrecruiters_embed`.

## Test Plan and Release Gates

- Unit tests: classifier rules, confidence scoring, option normalization, demographic mapping, resume upload helpers, overwrite protection, and field identity stability.
- Integration tests: DOM fixtures for each supported ATS family, including embedded iframe cases and multi-step rerender flows.
- End-to-end tests: profile setup, scan, selective fill, resume upload, blocked-permission handling, and post-fill verification inside the real extension.
- Public beta gate: at least 90% detection accuracy on supported fields, at least 99% fill accuracy for correctly identified fields, zero silent overwrites, median scan under 2 seconds on the fixture corpus, and passing flows for every supported ATS family including at least one embedded iframe case.

## Assumptions and Defaults

- Chrome-only MV3 extension; no backend, no login, local-first storage.
- Public beta is self-serve through the Chrome Web Store, not just a guided demo.
- Initial compatibility target includes Greenhouse, Lever, Workday, Ashby, and embedded ATS flows such as SmartRecruiters one-click inside corporate iframes.
- Full spec scope is in for MVP, but only fields/classes with proven accuracy should autofill automatically; uncertain fields stay review-only.
- Form submission, job tracking, and cloud sync remain out of scope.
