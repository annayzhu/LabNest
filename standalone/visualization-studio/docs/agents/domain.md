# Domain documentation

This repository uses a single-context domain-documentation layout.

## Before exploring

Read these resources when they exist:

- `CONTEXT.md`
- Relevant ADRs under `docs/adr/`

If these files do not exist, proceed without treating their absence as an error. Domain-modeling workflows create them only when terminology or architectural decisions need to be recorded.

## Vocabulary

Use terms defined in `CONTEXT.md` consistently in implementation plans, issues, tests, interfaces, and documentation. Avoid introducing synonyms for concepts already defined there.

## Architectural decisions

Check relevant ADRs before changing architecture. If a proposed change conflicts with an ADR, report the conflict explicitly rather than silently overriding the decision.
