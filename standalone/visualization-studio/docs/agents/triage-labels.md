# Triage labels

The engineering skills use five canonical workflow-state roles. Each role maps to the identically named GitHub label.

| Canonical role | GitHub label | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer evaluation is required |
| `needs-info` | `needs-info` | Waiting for information from the reporter |
| `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent |
| `ready-for-human` | `ready-for-human` | Requires human judgment or implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill refers to a canonical role, use the corresponding GitHub label shown above. Conflicting state labels must be reported before further mutation.
