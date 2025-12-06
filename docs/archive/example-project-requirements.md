# GAIT Code Quality Improvement Research/Ideas

## Existing Issues with codebase

- No type checking
- Using dictionaries/objects that aren’t validated everywhere
- Complex modules (eg. redis streams)
- Huge python files, over 2k lines of code
- Low integration test coverage (We need to have a comprehensive way of testing each endpoint with real HTTP request)
- No single source of truth for data objects
- No clear and consistent architecture (example layered architecture with services, repositories, etc.)
- No git hooks
- No linting
- No use of ruff or uv

## Ideas

- **Prek pre-commit** hooks which do the following:
  - Detect size of python files (no file should be more than 300 lines of code)
  - Ensure organisation keeps a certain standard/file structure
  - Ensure consistent file naming, eg. yml instead of yaml.
  - Ensure casing of files are correct according to standards
  - Enforce import logic for layer enforcement eg. services can’t import from controllers
  - Check commit message format references jira ticket and matches pattern
  - Function size limit
  - Class size limit
  - Number of parameters limit
  - Ruff linting
  - Type checking with mypy
  - Import sorting with Ruff
  - Linting for different file types (yaml, etc.)
  - openapi-diff for checking any changes to OpenAPI spec
  - Ensure single source of truth for all DTOs
  - Search for “dict” keyword to make sure it’s not being used
  - Ruff autoformatting
  - Ruff complexity checker
  - Bandit security linter
  - pydocstyle Docstring style checker
  - vulture for dead code detection
  - Run unit tests with pytest
  - Interrogate for docstring coverage
  - Detect secrets/commited env files
  - pip-audit/safety
  - check-merge-conflict
  - trailing-whitespace, end-of-file-fixer
  - no-commit-to-branch
- Some form of documentation system (specifically run books)
  - Swagger UI using openapi spec (for users)
  - Runbooks, developer how-to guides (markdown files)
- Improve Testing
  - unit tests which have no HTTP requests and provide at least 80% unit test coverage
  - Integration tests that cover every endpoint (create a check that ensures that all endpoints are being covered with integration tests, to get an integration test coverage, all paths)
  - Functional testing
  - End to End testing
  - Performance/Load testing
  - Smoke tests (running after deployment)
  - Test data repository (to reduce duplication in test data)
- Code Development process
  - Make PRs limited in size and scope (eg. to lines of code changed), linking to a Jira ticket.
  - Any PR merge can then be checked by the QA team, small incremental changes which can be checked for any issues.
  - Asynchronous, meaning developers should be able to push 4-5 different changes into some kind of “QA” testing backlog, to identify issues when they arise but without having QA as a bottleneck
- Code Quality Checks (outside of git hooks)
  - e2e tests
  - functional tests
  - integration tests
  - performance tests
  - Tests for complexity of the code (existing tooling for Python - cyclomatic, cognitive)
  - Maintability index (radon)
  - Function/method/class size distributions
  - Nesting depth analysis
  - Code duplication detection
  - Security scanning
  - Test for dependencies of modules (pydeps)
  - Create an overall score for the codebase which is aggregated from the results of all these quality checks

Gold standard FASTAPI example: https://github.com/Netflix/dispatch

## Interesting tools

- https://github.com/j178/prek
- https://github.com/astral-sh/ty

[Mintlify - The Intelligent Documentation Platform](https://www.mintlify.com/)

[Code Documentation](https://swimm.io/)
