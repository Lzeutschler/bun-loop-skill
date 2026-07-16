# Conditional Review Rubrics

Load only the sections matching the current item's demonstrated risk. These checks
supplement the item contract and executable oracle; they never replace either.

## State transitions and invariants

- Map every operation that creates, mutates, serializes, or consumes the affected
  state, including inverse and round-trip operations.
- Inspect all assignments to affected state fields and verify one inverse or
  round-trip path.
- Reject a consumer-side symptom patch while sibling writers can still construct
  the same invalid state.
- Check identity, ownership, dimensions, metadata, and indexes when observable.

## Exact structural semantics

- Derive required precedence, ordering, serialized form, symbolic tree, and error
  behavior independently from the author's tests.
- Treat mathematical or set equivalence as insufficient when callers observe exact
  structure or order.
- Run the original reproduction or a declared executable acceptance example.

## Parsers and compatibility boundaries

- Identify the shared parser or lexical primitive and every sibling frontend that
  consumes it before accepting a local parser fork.
- Keep previously rejected inputs rejected unless the task explicitly changes that
  boundary.
- Add negative controls around malformed, escaped, empty, and boundary inputs that
  the public contract admits.
- Reject broad grammar support when the contract requires only a narrow correction.

## Async, concurrency, and lifetimes

- Trace ownership across callbacks, thread or task boundaries, cancellation, and
  re-entrant user code.
- Check whether cleanup happens exactly once on success, error, cancellation, and
  partial initialization.
- Look for handles or pointers retained after their owning value drops, callbacks
  that mutate collections during iteration, and state observed between transitions.
- Prefer sanitizers, race detectors, leak checks, and stress or deterministic
  scheduler tests when the repository provides them.

## Ports and migrations

- Compare source and target behavior through a language- or implementation-neutral
  oracle.
- Record semantic differences between source and target languages, libraries, and
  runtime modes; do not assume syntactically similar constructs behave identically.
- Preserve architecture and public behavior unless the migration contract explicitly
  authorizes a change.
- Verify representative error paths, release and debug behavior, platform-specific
  branches, and backward-compatible data or protocol handling.
