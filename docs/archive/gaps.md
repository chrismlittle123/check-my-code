# CMC Enforcement Gaps Analysis

## Other Tools (CMC Can Orchestrate)

These are not fundamental limitations—they're tooling gaps that CMC can address by integrating with existing software.

| Gap                                 | Tool(s)                                     | How CMC Enforces                                                     |
| ----------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| "Requirements first, code second"   | Git hooks, Jira/Linear API                  | Block commits until linked issue exists with status="approved"       |
| Meaningful tests (not just green)   | Stryker, mutmut                             | Mutation testing thresholds—if mutants survive, tests aren't testing |
| Edge cases humans think of          | Hypothesis, fast-check, AFL                 | Property-based testing + fuzzing auto-generate edge cases            |
| Visual/UX regression                | Playwright, Chromatic, Percy                | Screenshot diffing with pixel thresholds                             |
| ADR quality                         | LLM review                                  | Score ADRs for structure, clarity, trade-off analysis                |
| Architecture smells                 | SonarQube, CodeClimate                      | Cyclomatic/cognitive complexity, code churn hotspots                 |
| "Loosely coupled" components        | dependency-cruiser, code-maat               | Instability metrics, change coupling analysis                        |
| Clean architecture layer violations | ArchUnit, dependency-cruiser, import-linter | Import boundary rules per layer                                      |
| Multi-model comparison              | Custom orchestration                        | Fan out prompts to N models, diff responses, flag disagreements      |
| Context pollution detection         | Token counter, semantic analysis            | Detect bloated context, stale references, redundancy                 |
| Finchley weekly learnings           | Finchley API                                | Sync learnings bidirectionally                                       |

## Humans Only

These require human judgment, creativity, or physical presence. No software can replace them.

| Gap                                                        | Why Software Cannot Solve                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Exploratory testing                                        | By definition unscripted and creative—software can assist (record sessions, suggest areas) but cannot replace human curiosity |
| Strategic correctness ("Are we building the right thing?") | Business judgment requiring market knowledge, user empathy, and strategic trade-offs that exist outside the codebase          |
| Workshop attendance                                        | Physical/calendar activity (though participation could be inferred via calendar APIs + Slack activity)                        |
