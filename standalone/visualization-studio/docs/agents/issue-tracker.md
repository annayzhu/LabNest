# Issue tracker: GitHub

Issues and specifications for this repository live in GitHub Issues.

- Repository: `annayzhu/Visualization-studio`
- Visibility: public
- Default branch: `main`
- Primary interface: the authenticated GitHub connector

## Conventions

- Use the authenticated GitHub connector to create, read, update, label, comment on, and close issues.
- Resolve bare references such as `#42` against this repository.
- Use GitHub Issues for feature requests, bugs, implementation tickets, and specifications.
- Do not publish issue-tracker mutations without user authorization.
- AI-generated triage comments must begin with the disclaimer required by the `triage` skill.

## Pull requests as a triage surface

**PRs as a request surface: no.**

External pull requests are not added to the triage queue automatically. An explicitly named pull request can still be inspected or triaged when the user requests it.

## When a skill says "publish to the issue tracker"

Create a GitHub Issue in `annayzhu/Visualization-studio` through the authenticated GitHub connector.

## When a skill says "fetch the relevant ticket"

Fetch the complete GitHub Issue, including its body, comments, labels, author, and current state.
