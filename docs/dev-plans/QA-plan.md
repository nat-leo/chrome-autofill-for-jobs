# Pre-Phase QA Suite for the Current Rollout

### Summary
- Treat the current repo as a Phase 0 shell only. Today it supports raw scan/edit/fill with `domIndex` targeting, auto-scan on panel mount, direct UI-to-content-script messaging, and basic notices; it does not have profile storage, semantic classification, fill policy, resume upload, or audit logging yet. References: [App.tsx](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/App.tsx#L74), [content.js](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/scripts/content.js#L21), [autofill.ts](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/types/autofill.ts#L1).
- Implement now = the reusable QA base plus tests for behavior that exists today. Do not spend time now on Phase 1-4 feature suites, other than creating their folders and shared harness hooks.
- Immediate harness facts: `build` and `lint` pass; Vitest is broken because [vitest.config.ts](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/vitest.config.ts#L12) points at a missing setup file; the only E2E coverage is a shallow extension-load smoke in [extension-side-panel.spec.ts](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/tests/extension-side-panel.spec.ts#L13).

### Base To Build Now
- Use one permanent tree under `autofill-extension/tests/` with `unit/phase0-shell`, `integration/shell`, `e2e/smoke`, `fixtures/{generic,shadow-dom,iframes}`, and `benchmarks/baseline`. Pre-create empty `phase1-profile`, `phase2-classification`, `phase3-fill`, and `phase4-release` folders so later rollouts only add cases.
- Split runners cleanly. Vitest should only collect unit/component/integration tests. Playwright should only collect `e2e`. Fix discovery so Playwright specs are never executed by Vitest, and restore `src/test/setup.ts`.
- Add a permanent fixture contract now. Each fixture page should declare `expectedEditableCount`, `controlTypes`, and `fillExpectations`. Later phases extend the same fixtures with `fieldType`, `confidence`, `frameId`, and site-family labels.
- Add a permanent benchmark contract now. Emit one record per fixture with `fixture`, `scan_ms`, `fill_ms`, `detected_count`, `expected_count`, `updated_count`, and `run_timestamp`.

### Tests And Benchmarks To Implement Now
- Harness repair:
  - Vitest setup smoke.
  - `npm test`, `npm run build`, and `npm run lint` as the Phase 0 gate.
  - Playwright extension bootstrap smoke that verifies the MV3 service worker and side panel page load from the built extension.
- Unit/component tests for current UI behavior:
  - `getErrorMessage` maps permission and missing-listener failures to the current user-facing copy in [App.tsx](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/App.tsx#L17).
  - `FieldList`, `FieldCard`, `PanelHeader`, `FillActions`, and `StatusNotice` cover loading, empty, disabled, success, and error states.
  - Content-script helpers are extracted or wrapped so tests can cover raw field discovery, label/value extraction, visibility flags, disabled/read-only flags, checkbox/radio/select/contenteditable writes, and invalid `FILL_FIELDS` payload handling from [content.js](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/scripts/content.js#L59).
- Integration tests with mocked `chrome.*` APIs:
  - panel auto-scans on mount and refresh rescans; keep this as the expected behavior until Phase 0 changes it.
  - `sendMessageWithRetry` reinjects the content script on “Receiving end does not exist”.
  - fill submits edited values, shows a success notice, and rescans.
  - empty state keeps fill disabled and renders the current guidance copy.
- E2E tests on local fixtures:
  - plain HTML form: scan detects editable controls, panel shows page title/url, manual edits fill text, textarea, select, radio, checkbox, and contenteditable, and success notice appears.
  - shadow DOM form: scan discovers nested editable fields and fill reaches them.
  - same-origin iframe form: scan aggregates iframe fields and fill updates them.
  - stale `domIndex` regression: mutate DOM between scan and fill and assert the partial-update result is surfaced instead of looking like a full success.
- Benchmarks to implement now:
  - scan latency on `generic`, `shadow-dom`, and `same-origin iframe` fixtures.
  - fill latency on one mixed-control fixture.
  - detected-count regression against fixture expectations. This is a raw coverage benchmark now, not a semantic-accuracy benchmark.

### Add Later When The Rollout Reaches It
- Remaining Phase 0 shell-hardening tests, only after those code changes land: scaffold branding removal, popup/side-panel action behavior, background-worker routing, stable `fieldId/frameId/selectorHint` contracts, and user-triggered-only scan behavior. References: [manifest.json](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/manifest.json#L2), [background.js](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/scripts/background.js#L1).
- Phase 1: profile CRUD, defaults, import/export, resume asset, migrations, and local-only storage tests.
- Phase 2: taxonomy, confidence, explainability, site adapters, frame-aware routing, and detection-accuracy benchmarks.
- Phase 3: overwrite protection, decision policy, per-field outcomes, blocked states, post-fill verification, and zero-silent-overwrite tests.
- Phase 4: packaged-build certification, ATS compatibility matrix, upgrade-path tests, long-session stability, and public-claim validation.

### Interfaces To Lock Now
- Freeze the current message-contract surface with tests for `SCAN_FIELDS`, `FILL_FIELDS`, `READ_FIELDS`, `READ_ACTIVE_ELEMENT`, and `READ_PAGE_CONTENT` from [content.js](/Users/natleo/Desktop/chrome-autofill-for-jobs/autofill-extension/src/scripts/content.js#L217).
- Keep the fixture schema additive across phases so the same corpus can power Phase 0 raw-scan regression and later Phase 2/4 accuracy certification.
- Keep the benchmark output schema stable across phases so later semantic metrics can be compared against the Phase 0 baseline without changing tooling.

### Assumptions And Defaults
- “Implement now” means shipping the reusable QA base and the tests the current code can realistically pass, not writing failing suites for unbuilt features.
- The current auto-scan-on-mount behavior stays in the regression suite until the Phase 0 shell refactor deliberately changes it; then replace that assertion rather than keeping both behaviors.
- Accuracy benchmarks, ATS certification, resume upload, storage, and overwrite-safety suites are intentionally deferred because the underlying product code does not exist yet.

# Phase QA Suite for MVP Deployment to Beta Users

## Phase 0 — Extension shell stabilization and trust baseline

**Purpose:** prove the extension is structurally sound before adding product logic. This phase is about installability, message flow, scan/fill plumbing, and regression harness repair. The rollout plan explicitly calls out broken automated validation and says the extension is not yet customer-ready. 

### Test areas

**Build and packaging**

* manifest validity
* background worker registration
* side panel registration
* icons/assets present
* production build output paths match manifest references
* extension loads unpacked in Chrome without missing file errors

**Startup and extension lifecycle**

* clicking extension action opens side panel
* background worker wakes correctly
* extension survives tab changes, refreshes, and service worker restarts
* no stale ports or broken message channels after reload

**Scan infrastructure**

* user-triggered scan works on a plain HTML page
* scan reaches light DOM, shadow DOM, and same-origin iframes
* scan does not run passively unless explicitly intended
* returned fields include stable identity primitives rather than only fragile positional indexing

**Fill plumbing**

* panel edits can be sent back to the page
* supported controls can be written to
* success and error notices appear correctly
* fill action against stale DOM fails safely and visibly

**Test harness repair**

* Vitest setup file restored and running
* Playwright launches extension reliably
* smoke suite runs in CI
* baseline fixtures added for plain forms, shadow DOM, and iframe pages

### Recommended test layers

**Unit**

* manifest/config validators
* field identity generation
* message schema validation
* scan result normalization

**Integration**

* content script + background worker messaging
* side panel <-> active tab message routing
* frame-aware scan result aggregation

**End-to-end**

* install extension
* open side panel
* scan fixture page
* manually edit value
* fill back into page
* verify UI notice and DOM change

### Exit gate

* build, lint, unit, integration, and E2E smoke all pass
* no broken asset/path references
* no silent messaging failures
* test harness is trusted enough to unblock feature work 

---

## Phase 1 — Canonical profile and local data layer

**Purpose:** validate that user data is stored, retrieved, migrated, and protected correctly before classification and autofill depend on it. The rollout plan calls for `chrome.storage.local`, IndexedDB resume storage, schema versioning, import/export, and safe defaults. 

### Test areas

**Profile CRUD**

* create profile from empty state
* edit each field individually
* save and reload persistence across browser restart
* partial saves do not erase unrelated fields

**Settings and defaults**

* overwrite disabled by default
* manual review enabled by default
* no auto-submit behavior exists
* local-only storage behavior is honored

**Resume asset handling**

* upload valid resume
* replace resume with newer file
* resume metadata persists
* corrupted or oversized file fails gracefully
* missing blob / orphan metadata recovery

**Schema and migrations**

* old schema migrates forward correctly
* unknown schema version handled safely
* import from previous export format works
* migration failure does not destroy data silently

**Import/export**

* export contains all supported structured fields
* import validates shape and version
* malformed import rejected with user-facing error
* sensitive fields not duplicated or partially merged incorrectly

**Privacy and local-only behavior**

* no unexpected network requests during save/load
* all storage operations remain local
* deleted profile data is actually removed from storage

### Recommended test layers

**Unit**

* profile validators
* migration functions
* import/export serializers
* resume metadata parsing
* settings default resolver

**Integration**

* chrome.storage.local adapter
* IndexedDB adapter
* save profile -> reload extension -> rehydrate panel
* mixed storage reads between settings/profile/resume asset

**End-to-end**

* user enters profile
* uploads resume
* closes/reopens extension
* verifies persisted values
* exports profile
* imports into clean profile state
* verifies exact restoration

### Exit gate

* profile persistence is reliable
* migrations are deterministic
* import/export is reversible
* no storage corruption or accidental overwrite paths 

---

## Phase 2 — Detection and classification engine

**Purpose:** verify that field detection becomes semantic, explainable, frame-aware, and adapter-driven rather than just a raw DOM inspector. The rollout plan makes this the core MVP transition. 

### Test areas

**Field extraction coverage**

* labels, placeholders, aria attributes, legends, nearby text, headings, ancestry, options, and iframe context are all considered
* unlabeled but inferable fields can still be classified
* noisy pages do not over-classify decorative or irrelevant controls

**Taxonomy correctness**

* all supported field types map into the `SupportedFieldType` set
* unsupported fields are explicitly marked unsupported
* ambiguous fields become needs-review instead of being guessed incorrectly

**Confidence scoring**

* high-confidence examples score above threshold
* borderline cases fall into review bucket
* confidence is stable across minor DOM changes
* wrong-site noise does not inflate confidence

**Site-family detection**

* generic pages classified as generic
* Greenhouse / Lever / Workday / Ashby / SmartRecruiters embedded flows correctly detected
* embedded iframe context preserved in site-family classification

**Frame-aware routing**

* each detected field has `frameId`
* fillable field routes back to correct frame
* same field label in parent page vs iframe remains distinguishable

**Reason/explainability**

* side panel reason text aligns with actual classifier inputs
* confidence + reason + fillability reflect same decision
* manual QA can understand why a field was or was not selected

### Recommended test layers

**Unit**

* label extraction
* contextual signal extraction
* classifier rules
* confidence score calculation
* site-family detection
* option normalization
* taxonomy mapping

**Integration**

* synthetic DOM fixtures for each ATS family
* iframe fixtures
* multi-step pages where rerender changes markup
* classifier outputs compared against golden snapshots

**End-to-end**

* open supported ATS fixture
* scan application
* verify detected field type / confidence / reason in side panel
* verify embedded iframe case shows correct context

### Exit gate

* supported-field detection accuracy meets internal threshold on fixture corpus
* unsupported fields are skipped, not misfilled
* site adapters outperform generic fallback on target ATS pages
* classifier output is explainable enough for manual QA and beta users 

---

## Phase 3 — Harden fill behavior into a real autofill product

**Purpose:** move from “can write values into forms” to “can safely autofill customer forms without causing damage.” This is where correctness, overwrite prevention, and post-fill verification matter most. 

### Test areas

**Decision policy**

* high-confidence fields autofill by default
* low-confidence fields are skipped unless explicitly enabled
* manually corrected fields can be filled intentionally
* unsupported fields remain untouched

**Overwrite protection**

* existing page value is preserved by default
* overwrite-once setting works only for that run
* hidden default values or prefilled ATS values are not silently replaced
* race conditions do not cause accidental overwrites after rerender

**Type-specific filling**

* text inputs
* textareas
* selects
* radio groups
* checkbox groups
* combobox-like widgets
* contenteditable controls
* resume file upload
* each handler triggers the right DOM events for the target control

**Outcome reporting**

* every attempted field returns one of the expected result states:
  `filled`, `skipped_existing_value`, `skipped_low_confidence`, `blocked`, `unsupported`, `failed`
* panel summary totals match per-field outcomes
* partial failures do not masquerade as success

**Post-fill verification**

* page is rescanned after fill
* actual page state matches reported fill state
* SPA rerenders do not erase filled values without detection
* retry guidance appears where rerender invalidates field handles

**Safety and blockers**

* cross-origin frame restrictions fail visibly
* missing permissions fail visibly
* disabled/read-only/hidden fields are blocked, not force-filled
* submit buttons are never triggered as part of fill

### Recommended test layers

**Unit**

* fill decision policy
* overwrite guard logic
* per-control event dispatch behavior
* result-state mapping
* post-fill verification comparison logic

**Integration**

* DOM fixtures with prefilled values
* rerendering SPA fixtures
* widget-specific controls
* permission-blocked and read-only fixtures
* upload handler fixtures

**End-to-end**

* profile setup
* scan supported application
* selective fill
* verify only intended fields changed
* verify outcome log
* verify no submit occurred
* verify rescan reflects actual state

### Exit gate

* zero silent overwrites
* no false-success reporting
* all supported control families pass fill and verification tests
* regression suite covers major failure modes, not just happy path 

---

## Phase 4 — Public beta release readiness

**Purpose:** prove the product is supportable, truthfully marketable, and operationally safe for external users. The rollout plan says to narrow claims to proven ATS coverage and require specific accuracy thresholds. 

### Test areas

**Release packaging**

* Chrome Web Store package builds cleanly
* store listing assets match shipped product
* permissions and privacy disclosures match actual behavior
* version upgrade path works from earlier beta builds

**Compatibility certification**

* certification matrix for each claimed ATS family
* at least one embedded iframe case per supported embedded flow
* documented known limitations reproduce exactly as stated
* unsupported sites degrade gracefully

**Performance and reliability**

* median scan under target threshold
* fill latency acceptable on supported pages
* repeated scans/fills do not leak memory or duplicate UI state
* service worker and side panel remain stable over long sessions

**Closed beta / dogfood feedback validation**

* top bug categories have regression tests
* common user confusion points covered by UX assertions
* support docs match actual behavior
* install flow, permission prompts, and recovery flows are testable end to end

**Claims validation**

* 90%+ detection accuracy on supported fields
* 99%+ fill accuracy for correctly identified fields
* all claimed ATS families pass release suite
* no “universal autofill” language unless proven

### Recommended test layers

**Certification suite**

* a labeled fixture corpus per ATS family
* benchmark runs for detection/fill accuracy
* release dashboard summarizing pass/fail by site family and scenario

**End-to-end release tests**

* install from packaged build
* profile setup
* scan + fill on each supported family
* embedded iframe case
* blocked permission case
* upgrade from previous beta version

**Manual exploratory**

* real-world applications outside fixtures
* noisy enterprise portals
* long multi-step applications
* accessibility-heavy forms
* regression against sites previously known to fail

### Exit gate

* all public claims backed by repeatable test evidence
* release checklist signed off by QA
* known limitations documented
* no blocker or critical severity bugs open for supported scenarios 

---

## Cross-phase test tracks that should exist the whole time

These should run throughout the rollout instead of living in only one phase:

**1. Contract tests**
For message contracts like `GET_PROFILE`, `SAVE_PROFILE`, `SCAN_APPLICATION`, `FILL_SELECTED_FIELDS`, `UPLOAD_RESUME`, and `GET_FILL_LOG`. These should fail fast when payload shapes drift. 

**2. Regression fixtures**
Keep a permanent fixture library for:

* plain HTML forms
* shadow DOM
* same-origin iframe
* rerendering SPA
* each ATS adapter family
* embedded one-click application flow

**3. Negative and adversarial tests**

* misleading labels
* duplicated labels
* hidden fields
* disabled fields
* prefilled values
* dynamic DOM mutation during fill
* broken iframe access
* malformed profile data
* stale selectors / stale field IDs

**4. UX and safety assertions**

* clear blocked-state messaging
* clear skipped-state messaging
* no silent data loss
* no auto-submit
* no surprise overwrite
* no unsupported-field fill

**5. Performance tests**

* scan time
* fill time
* number of detected fields vs expected
* stability over repeated scans and fills

---

## Severity focus by phase

A useful QA prioritization model:

* **Phase 0:** prioritize blocker and critical infra bugs
* **Phase 1:** prioritize data loss, corruption, and privacy bugs
* **Phase 2:** prioritize misclassification and false-confidence bugs
* **Phase 3:** prioritize overwrite, wrong-field-fill, and false-success bugs
* **Phase 4:** prioritize claim-invalidating bugs and cross-site compatibility failures

---

## Suggested folder / suite structure

```text
tests/
  unit/
    phase0-shell/
    phase1-profile/
    phase2-classification/
    phase3-fill/
    phase4-release/
  integration/
    shell/
    storage/
    classifier/
    fill-engine/
    adapters/
  e2e/
    smoke/
    profile/
    supported-sites/
    iframe-flows/
    safety/
    release-certification/
  fixtures/
    generic/
    shadow-dom/
    iframes/
    greenhouse/
    lever/
    workday/
    ashby/
    smartrecruiters/
```

---

## QA recommendation

Do not treat this as “build features, then test later.” For this rollout, each phase should ship with its own test gate, and the most important suites are Phase 2 and Phase 3 because that is where customer trust is won or lost: correct classification, safe fill behavior, and honest outcome reporting. That matches the rollout plan’s emphasis on semantic classification, confidence-based autofill, iframe-aware routing, reliability safeguards, and release gates for accuracy. 

I can also turn this into a test matrix with columns for phase, test case, priority, automation level, and release gate.
