# Make Course Uploads Reliable End to End

Course authoring must persist every uploaded asset and nested content item consistently across Prisma, PostgreSQL, Cloudflare R2, API routes, and the admin UI. This design fixes the current schema drift, closes incomplete persistence paths, and adds executable coverage for the full upload lifecycle without rewriting applied migrations or overwriting existing course data.

## Outcome

An administrator can create or edit a course, upload thumbnails, presentation images, resources, and multipart videos, then reload or publish the course without losing data, duplicating records, or encountering missing-column errors.

## Decisions

| Area | Decision |
|---|---|
| Schema drift | Restore fields still required by active code through a new forward Prisma migration. Never edit an already-applied migration to repair a deployed database. |
| Compatibility | Preserve `videoUrl` and `transcript` compatibility while `videoFileUrl` remains the canonical uploaded-video field. Remove legacy fields only in a separately designed migration after dependent AI and transcription flows are retired. |
| Query safety | Use explicit Prisma selections at module and lesson API boundaries so response shapes remain intentional and schema drift cannot silently expand queries. |
| Resource persistence | Add an explicit deferred-persistence contract. Hierarchical uploads create exactly one `LearningResource` and never create a legacy `CourseResource` as a side effect. |
| Drafts and publishing | Complete the draft storage and API contract before enabling editor calls. Publishing is transactional and includes style presentation videos. |
| Upload validation | Validate authorization, entity ownership, file metadata, part numbers, ETags, object keys, and size boundaries on the server. Client metadata is never treated as proof of a completed R2 object. |
| Test discovery | Configure Vitest so course-upload tests under `tests/` are executed, while keeping incompatible Jest suites isolated until migrated. |
| Existing work | Preserve the dirty worktree and existing course data. Changes are limited to upload/course-authoring behavior and its tests. |

## Data flow

### Direct images

1. The client validates the selected image and starts the upload immediately.
2. The authenticated admin image endpoint validates the request and writes to R2.
3. The endpoint returns a trusted public object URL and object key.
4. The course, module, or style save persists that URL.
5. Reload verifies that the persisted URL is returned by the corresponding API.

### Multipart videos

1. The client requests a multipart upload for an existing course and valid video metadata.
2. The server creates an R2 multipart upload and returns bounded part instructions.
3. The client uploads parts with real byte progress and collects ETags.
4. The server validates part numbers and ETags, completes the upload, and returns the trusted object URL.
5. The entity save persists `videoFileUrl`; abort and retry remain idempotent.

### Hierarchical resources

1. The client requests a presigned upload with `deferPersistence: true`.
2. The client uploads to R2 and confirms object completion without creating a legacy resource row.
3. The scoped learning API validates parent ownership and creates one `LearningResource`.
4. Reload returns exactly one resource attached to the intended course, module, style, or lesson.

## Work units

### 1. Restore schema parity

- Add a forward migration for active legacy-compatible module and lesson columns.
- Regenerate Prisma Client after migration application.
- Add regression coverage for module and lesson create/read/update operations against the migrated schema.
- Keep historical migrations unchanged.

### 2. Harden authoring persistence

- Apply explicit selections to direct lesson and module API operations.
- Persist style `videoFileUrl` during synchronization and publication.
- Complete or remove incomplete draft calls as one coherent unit; the selected implementation must include storage, routes, transactions, and tests together.
- Validate cross-course parent relationships and ordering invariants.

### 3. Harden upload contracts

- Implement and propagate `deferPersistence` for hierarchical resources.
- Reject missing, zero, negative, non-integer, or oversized file sizes.
- Validate course existence and ownership before multipart creation.
- Validate multipart part numbers, ETags, keys, retries, aborts, and completion failures.
- Prevent duplicate persistence when retries or confirmation requests are repeated.

### 4. Make upload tests executable

- Include the relevant root upload tests in Vitest or relocate them under the configured source test boundary.
- Convert only the affected course-upload tests to Vitest APIs; do not mix unrelated legacy Jest migration into this work unit.
- Add focused API, service, component, and database integration coverage.

### 5. Verify the real workflow

- Use temporary local database fixtures and disposable R2 objects authorized by the user.
- Exercise create, reload, edit, replace, retry, cancel, publish, and delete paths.
- Verify admin authorization and cross-course isolation.
- Confirm the browser shows actionable errors rather than raw Prisma or infrastructure messages.
- Keep the local server running after verification.

## Error handling

- API responses expose stable user-safe error codes and messages; raw Prisma, R2, stack, and environment details remain server-side.
- Upload success followed by persistence failure is reported distinctly and records enough object identity for cleanup.
- Multipart abort is safe to repeat.
- Publication rolls back database changes when any nested synchronization step fails.
- Cleanup failures are reported rather than silently ignored.

## Test matrix

| Boundary | Required coverage |
|---|---|
| Authorization | Anonymous, authenticated non-admin, missing user, and admin cases for every upload and authoring endpoint. |
| File metadata | Zero, missing, negative, non-integer, maximum, maximum plus one, accepted MIME types, rejected MIME types, and misleading extensions. |
| Multipart | Create, sign, upload, complete, abort, duplicate parts, invalid part numbers, missing ETags, stale upload IDs, retries, cancellation, and R2 failures. |
| Persistence | Module, style, lesson, thumbnail, banner, video, and resource values survive save and reload without duplicate rows. |
| Integrity | Wrong parent, cross-course IDs, concurrent ordering, repeated confirmation, transaction rollback, and draft isolation. |
| Browser UX | Immediate upload, real progress, cancel, retry, success, replacement, validation, safe error feedback, accessibility, and unsaved navigation. |
| Database | Fresh migration and existing migrated database reach the same schema expected by Prisma. |

## Acceptance criteria

- [ ] Creating a lesson no longer references a missing `Lesson.videoUrl` column.
- [ ] Prisma schema and the migrated PostgreSQL schema agree for active module and lesson fields.
- [ ] Every course asset survives reload and publication.
- [ ] Hierarchical resource upload creates one `LearningResource` and no legacy duplicate.
- [ ] Multipart video retries and cancellation do not create duplicate database rows.
- [ ] Draft and publish endpoints either work transactionally or are not called by the UI.
- [ ] Course-upload tests are discovered and pass under the repository test command.
- [ ] Browser smoke tests complete without raw technical errors.
- [ ] PostgreSQL, R2-backed uploads, and the local Next.js server remain usable after verification.

## Out of scope

- Migrating every unrelated Jest suite to Vitest.
- Redesigning the course editor visual language.
- Changing R2 credentials, bucket policy, production data, or authentication architecture.
- Removing legacy transcription fields before dependent AI flows receive a separate migration plan.

## Rollback boundaries

Each work unit must be independently reversible: schema compatibility migration, authoring persistence, upload contracts, test discovery, and browser fixtures. Rollback must not delete unrelated user changes or historical course data.
