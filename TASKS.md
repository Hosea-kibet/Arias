# Arias implementation tasks

Each tool action is a separate implementation task. For example, appending sheet rows and reading sheet rows are different tasks. At runtime, one incoming event can produce several `ToolCall` records.

The scaffold is complete. Everything below is pending. Arias owns the backend and orchestration, OpenAI chooses agent tools, and the Bolt SDK is used to call Slack APIs.

## Shared foundation

- [x] **CORE-01 — Event processing and tool execution**
  - Wire persisted events to `EventRouter` through a worker, with `PENDING → PROCESSING → COMPLETED / FAILED` transitions.
  - Build a shared executor that finds registered tools, validates inputs with Zod, and records inputs, outputs, errors, and timing in Prisma `ToolCall` records.
  - Add execution identifiers and status fields through a migration where needed. Handle duplicate delivery and interrupted work without blindly repeating external writes.
  - Done when a fake tool can complete or fail a persisted event, invalid arguments never reach the tool, and duplicate claims cannot execute the same event concurrently.

- [ ] **CORE-02 — OpenAI orchestration**
  - Implement `OpenAIService` using the configured model and the tool registry.
  - Pass tool requests to the shared executor, return their results to OpenAI, and collect the final response. Support multiple tool calls in one request.
  - Preserve caller, channel/thread, and timezone context. Ask for missing details instead of inventing destinations, spreadsheet IDs, or dates.
  - Bound tool-call rounds and execution time; report partial success accurately.
  - Done when a mocked agent response can invoke a tool, receive its result, and produce a final answer; unknown tools and exhausted limits fail predictably.
  - Depends on: CORE-01.

- [ ] **AUTH-01 — Google API client**
  - Connect the shared Google client to configured OAuth credentials and refresh tokens.
  - Establish the calendar/spreadsheet resources available to the initial configured account.
  - Done when Calendar and Sheets services can share authentication and expired/missing credentials produce useful errors without exposing secrets.

- [ ] **AUTH-02 — Slack API client through Bolt SDK**
  - Expose a shared Slack API client for messages and reminders from the custom backend.
  - Verify the token type and scopes required for each operation; keep inbound event transport separate from outbound API calls.
  - Done when integration services can use the client with mocked responses and missing credentials fail clearly.

## Tool tasks — one action per task

- [ ] **TOOL-01 — Append Google Sheets rows: `sheets_append_rows`**
  - Input: `spreadsheetId`, `range`, and `values`.
  - Implement `SheetsService.appendRows`, preserving the existing Zod validation. Start with literal cell values so text is not accidentally interpreted as a formula.
  - Return the spreadsheet ID, written range, and number of rows written.
  - Done when valid rows reach the configured sheet, invalid rows fail before the API call, and API errors reach the executor. A retry after an uncertain write must not silently append duplicates.
  - Depends on: CORE-01, AUTH-01.

- [ ] **TOOL-02 — Create Google Calendar event: `calendar_create_event`**
  - Input: `calendarId`, `summary`, `start`, and `end`.
  - Implement `CalendarService.createEvent`, including explicit timezone offsets and end-after-start validation.
  - Return the provider event ID, event link, and confirmed start/end times.
  - Done when a valid request creates an event, invalid times fail before the API call, and repeated execution is handled without silently creating another meeting.
  - Depends on: CORE-01, AUTH-01.

- [ ] **TOOL-03 — Create Slack reminder: `reminders_create`**
  - Input: `text` and `time`, with recipient and timezone resolved from authenticated request context.
  - Implement `RemindersService.createReminder` through the Bolt SDK's Slack API client. Verify the supported native reminder method, token type, and scopes before wiring the call.
  - Return the reminder ID and confirmed scheduling details. Resolve ambiguous times before executing.
  - Done when a supported reminder request succeeds and unsupported recipients, missing permissions, and invalid times produce explicit errors.
  - Depends on: CORE-01, AUTH-02.

- [ ] **TOOL-04 — Post Slack reply: `slack_post_reply`**
  - Input: reply text plus channel/thread identifiers supplied by the original event context.
  - Add a Slack service action that posts the final response through the Bolt SDK and returns the message ID/timestamp and channel.
  - Initially this is a backend-controlled output action after orchestration. The model produces the text; the backend chooses the destination and sends the confirmation once.
  - Done when a result is posted to the originating conversation, failed tools are not reported as successful, and a reply failure does not rerun completed Calendar/Sheets/reminder writes.
  - Depends on: CORE-01, AUTH-02.

## Connect and release

- [ ] **FLOW-01 — Receive Slack events**
  - Choose and implement the inbound transport, verify its authenticity, and map messages/mentions into Arias events.
  - Preserve workspace, user, channel, thread, provider event ID, and timezone context. Ignore bot messages to prevent reply loops.
  - Done when one supported Slack message creates one queued event and provider retries do not create duplicates.
  - Depends on: CORE-01, AUTH-02.

- [ ] **FLOW-02 — Complete request-to-reply workflow**
  - Connect Slack input → event worker → OpenAI → tool execution → Slack reply.
  - Verify single-tool and multi-tool requests, missing details, partial failures, and process restarts using mocked providers first.
  - Run live checks only against designated test resources with configured credentials.
  - Depends on: CORE-02, FLOW-01, TOOL-01 through TOOL-04.

- [ ] **OPS-01 — DigitalOcean deployment verification**
  - Build/run the Docker image, apply migrations, check health, verify restart behavior, and test database backup/restore on the chosen Droplet.
  - Review the documented dependency advisories and configure server-side credentials before release.
  - Done when the complete workflow works in the deployed environment and persisted state survives container replacement.
  - Depends on: FLOW-02.

## Build order

Start with **CORE-01 → AUTH-01 → TOOL-01 (Sheets append)**. This gives us one complete tool execution path before connecting OpenAI. Then implement CORE-02, AUTH-02, TOOL-04, and FLOW-01 to deliver the first Slack-to-Sheets-to-Slack workflow. Add TOOL-02 and TOOL-03, complete FLOW-02, and verify deployment with OPS-01.

## Future tool tasks

Add these as individual tasks when we need them: read sheet rows, update sheet cells, list calendar events, update a calendar event, cancel a calendar event, list reminders, and cancel a reminder. They are outside the initial implementation above.
