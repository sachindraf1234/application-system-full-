# Attached E-Visa automation files — static review

**Review only:** The supplied files were read and syntax-parsed. The candidate-specific program and `.bat` files were **not run**, and no real portal session or applicant documents were accessed. Do not share the attached script or its README publicly: they contain an applicant identifier, local folder details and operational context.

## What the five files are

- `evisa_automation_E25110721257414.txt`: ~11,708 lines of Python source, not a `.py` file. It parses, but parsing does not prove it will work at the live portal. It contains hard-coded applicant data and a local document path.
- `de66289d686ee38ac1c79b076f4df920.txt`: Windows batch launcher, downloaded as `.txt`; it searches for a `.py` file and otherwise runs the first `*.py` it finds, so the supplied `.txt` does not satisfy its filename check. It installs dependencies at launch and opens browser automation.
- `6cf22bb2024d09b05a8d82f8d78727af.txt`: Windows batch script, downloaded as `.txt`, that enables remote-debugging port 9222 in Chrome. Exposing that port and reusing a personal browser profile are avoidable security risks.
- `requirements.txt`: lists Playwright, python-dotenv, OpenCV, NumPy and Pillow, but omits `pypdf`, which the Python source imports. Installation does not verify compatibility with the selected interpreter.
- `README.txt`: promises face alignment, all-page navigation, and document upload for one specific applicant. Those outcomes are not proven by a successful Python syntax check.

## Gaps and risks observed

1. **Packaging and filenames:** A `.txt` Python program and `.txt` batch scripts are not a runnable `.py`/`.bat` package. The launcher expects a particular `.py` name; an arbitrary first-file fallback risks running the wrong program.
2. **Portability:** The script is bound to one candidate, one local folder and assumptions about the current portal DOM. It searches beyond a selected folder and may download or create temporary files. Do not apply those values to another person.
3. **Safety:** It contains CDP/persistent-browser code, file-upload actions and Save/Next logic. Live browser behaviour was not verified here. A launcher that updates pip and installs dependencies automatically without an explicit review step is not appropriate for applicant records.
4. **Claims:** Automatic face positioning and a flawless end-to-end run cannot be established without permissioned test documents, a current portal session, selector inspection and human review.

## Updated packages after the automatic Save/Next request

**Original-flow option:** The attached candidate's direct ZIP now contains the Python source **byte-for-byte unchanged**, merely renamed from `.txt` to `.py`, along with Windows launchers, README and dependencies (the launcher/requirements add missing `pypdf`). For selected candidates in the AI Extractor's **Local Python & Playwright Visa Automation Suite**, the archived template replaces only central applicant/folder/URL configuration and person-specific literals. The original 96 functions, including the portal-driving Save/Next, document, summary and legacy helper functions, are preserved. Neither ZIP contains applicant document files. **Final submission stays manual.** The full original program and Windows launchers were not live-tested. The extracted Save/Next method was run on an offline Playwright mock: it clicked Save then Next, honored its supporting-document guard, and never clicked a mock final-submit button. Importantly, the original also clicked Next when Save was not found. No new preflight, origin restriction or Save-failure stop was retained: review all legacy defaults and portal behavior before running.

**Conservative alternative:** The earlier standalone `.py`/`.bat` ZIP is still available. It dry-runs by default; `--run` opens an isolated browser, requires manual login/stage review, and makes Save/Next clicks only after typed confirmation with reviewed XPath arguments. Its optional uploads require an explicit map and per-file confirmation. It never uses CDP. Both packages are local downloads only: the app server neither reads the operator's folder nor runs a live browser.

**Validation performed:** The app passed TypeScript checking, production build, API/browser integration tests, local ZIP-content and standalone Python dry-run checks. A separate headed Python Playwright run against a private localhost mock portal filled a synthetic surname/passport, clicked Save twice and Next once only after typed confirmations, and never clicked the mock final-submit button. This is **not** evidence that selectors, Save/Next, uploads or authentication work on the live Romanian visa portal. A Windows `.bat` could only be inspected here, not executed on a Windows PC. Real-portal validation requires explicit authorization and test data.
