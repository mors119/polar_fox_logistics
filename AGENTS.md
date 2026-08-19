
# AGENTS.md

## Development
- Read the existing project structure and conventions before making changes.
- Reuse existing code and patterns whenever possible.
- Keep changes limited to the requested scope.
- Do not introduce new dependencies unless necessary.
- Prefer simplifying or removing code over adding unnecessary abstractions.
- Do not modify unrelated files.

## Testing
- Check `.github/workflows` and existing scripts to determine the required validation steps.
- Run all relevant tests, linting, formatting, and build checks before finishing.
- Add or update tests when behavior changes.
- Fix all failures caused by the changes.
- Do not skip validation unless the required environment is unavailable; report any skipped checks clearly.

## Git
- Check `git status --short` before starting.
- Do not overwrite or modify unrelated existing user changes.
- Create a dedicated branch for the task unless already working on an appropriate branch.
- Review the final diff before committing.
- Use a short, descriptive commit message.

## Pull Request
- Complete the task through pull request creation unless explicitly told not to.
- Push the working branch to the remote.
- Create a PR targeting the repository's default development branch.
- Write a concise PR title and description explaining:
  - what changed
  - why it changed
  - how it was tested
- Link the related issue when one exists.
- Do not stop after implementation or commit if PR creation is possible.