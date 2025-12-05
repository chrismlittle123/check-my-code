# Gold Standard Wiki Draft Template

# AI Coding @ Palindrom – Playbook & Standards

> 🧭 Purpose
>
> Make AI-assisted coding reliable, safe, and insanely fast by standardising how we design, build, test, and ship software with agents.

---

## 1. Overview

**Why this exists**

- AI coding tools are now good enough that:
  - The **coding step** is being automated rapidly.
  - The real leverage is in **requirements, architecture, testing, and observability**.
- This page describes:
  - How we want to **use agents**.
  - How we **keep quality high** as output scales.
  - The **tools, patterns, and rituals** we’re converging on as a team.

**Who this is for**

- Everyone writing or reviewing code (human or agent-assisted).
- People designing systems and processes around AI coding.
- New joiners who need to understand “how we build things here.”

---

## 2. Core Principles

- **Agents are smart, but not wise**
  Use them for speed and breadth; humans remain accountable for “are we doing the right thing?”
- **Testability over cleverness**
  Small, modular, well-tested components beat giant “omega” classes and spaghetti.
- **Requirements first, code second**
  The biggest failure mode is building the wrong thing very quickly.
- **As little scaffolding as possible**
  Prefer simple, powerful agents plus good prompts and standards over heavy, brittle multi-agent frameworks.
- **Security is non‑negotiable**
  Assume anything readable on your machine might leave your machine.

---

## 3. Delivery Loop (Where AI Fits)

We treat delivery as a loop:

1. **Understand & frame the problem**
   - Talk to users / stakeholders.
   - Write down clear requirements & constraints.
2. **Design & architecture**
   - High-level design.
   - ADRs + diagrams.
3. **Implement**
   - Human + agents.
   - Follow standards & templates.
4. **Test & validate**
   - Automated tests, coverage, negative paths.
   - Manual exploratory checks where needed.
5. **Deploy & observe**
   - Monitoring, logs, alerts.
   - Feedback from real usage.
6. **Iterate**
   - Refine based on data, not vibes.

> 🔑 Key idea: Step 3 (coding) is getting “free” thanks to AI.
>
> The compounding value is in steps 1, 2, 4, and 5.

---

## 4. Quality Tiers (How “Serious” Is This Project?)

Use these tiers to decide how many guardrails we turn on.

### 4.1 Tier 1 – Prototype / Spike

- **Goal:** Fast learning, demos, throwaway exploration.
- **Expectations:**
  - Works on my machine is good enough.
  - Zero tests acceptable.
  - Formatting and linting optional.
  - No long-term support guaranteed.
- **Allowed shortcuts:**
  - Ad-hoc architecture.
  - Low/no coverage.
  - Minimal docs.

### 4.2 Tier 2 – Internal Tool / Non-critical

- **Goal:** Long-lived internal value, moderate risk.
- **Expectations:**
  - ✅ Linting & formatting enforced via **Check My Code (CMC)**.
  - ✅ Basic modular architecture (DI where it matters).
  - ✅ Unit tests for core logic; some integration tests.
  - ✅ Basic regression suite covering main workflows.
  - ✅ Manual testing of key workflows before releases.
  - ✅ CodeCov check with agreed minimum coverage.
  - ✅ Basic monitoring/logging.
  - ✅ Short ADRs for major design decisions.

### 4.3 Tier 3 – Production / External / Sensitive

- **Goal:** User-facing, reputation & revenue at stake.
- **Expectations:**
  - ✅ Strict standards via **CMC** Production Tier rule set.
  - ✅ Solid modular architecture (Clean architecture, dependency injection at top level).
  - ✅ Unit + integration + functional + negative-path tests.
  - ✅ Comprehensive regression suite with automated CI runs.
  - ✅ Mandatory manual testing checklist and exploratory testing sessions.
  - ✅ Coverage targets defined & enforced (CodeCov) - 80% coverage target.
  - ✅ Observability (metrics, logs, dashboards, alerts).
  - ✅ Security review, least-privilege keys, no secrets in repo.
  - ✅ ADRs + up-to-date diagrams.
  - ✅ Small, atomic PRs only; AI code reviewed like human code.

---

## 5. Architecture & Code-Structure Guidelines

### 5.1 Design for testability

- Prefer many **small, focused units** over large god-classes.
- If coverage can’t get past ~20% even after many tests → architecture smell.
- Keep components and services **loosely coupled** so they can be tested in isolation.

### 5.2 Dependency Injection (DI)

- Inject dependencies at the **top level** of the app.
- Modules should depend on **interfaces/types**, not concrete implementations.
- Example patterns:
  - Pass in `jsonParser` instead of importing from a specific path.
  - Pass in `httpClient`, `dbClient`, etc., from a central composition root.
- Benefits:
  - Easier mocking.
  - Less brittle imports.
  - Clearer mental model of the system’s wiring.

### 5.3 Clean Architecture / Layering

- Separate:
  - **Use cases / flows** (or “application layer”).
  - **Domain models**.
  - **Infrastructure / adapters** (DB, APIs, file systems).
- Rules of thumb:
  - Use cases can import domain & infrastructure.
  - Domain should **not** depend on infrastructure.
  - Infrastructure should not import use cases.
- Consider **type-only modules** to share types without pulling in full implementations.

### 5.4 Branching & PR Strategy

- One branch = **one atomic purpose**.
- Branches should be **mergeable in any order** whenever possible.
- If your feature requires foundational changes:
  - Split “foundations” into its own branch.
  - Feature branch builds on that.
- Aim for small PRs:
  - Easier human + AI review.
  - Fewer surprises during merge.

### 5.5 ADRs & Diagrams

- For non-trivial decisions, write an **ADR (Architectural Decision Record)**:
  - Very short.
  - Bullet style, e.g.:
    - Context (1–2 bullets).
    - Decision (1–2 bullets).
    - Consequences (1–2 bullets).
- Keep ADR bullets:
  - < 8 words per bullet.
  - ~5 bullets total.
- For flows and complex interactions, add a **Mermaid diagram**.

---

## 6. Testing & Coverage

### 6.1 Principles

- Tests are our main defence against “looks right but is wrong”.
- Coverage % is a **heuristic**, not the goal.
  - High coverage on badly designed tests is still bad.

### 6.2 Guidelines

- **Unit tests** for core business logic and critical utility functions.
- **Integration tests** for interactions between modules and external systems.
- **Negative-path tests** to ensure systems fail safely/gracefully.
- Use **CodeCov** (or equivalent) in CI:
  - Tier 1: optional / loose target.
  - Tier 2: agreed minimum on key modules.
  - Tier 3: stricter targets and enforced gates.

### 6.3 AI & tests

- Agents can:
  - Write test skeletons.
  - Propose scenarios.
  - Update tests when code changes.
- Humans must:
  - Check that tests are meaningful, not just green.
  - Add edge cases the agent wouldn’t think of.

### 6.4 Regression & Manual Testing

- **Regression testing**
  - Ensures that new changes haven't broken existing functionality.
  - Build a regression suite that covers:
    - Critical user journeys (happy paths).
    - Previously fixed bugs (to prevent reintroduction).
    - Integration points between major components.
  - Run regression suites:
    - Before major releases.
    - After dependency updates or framework upgrades.
    - When refactoring core modules.
  - Tier expectations:
    - **Tier 1:** No regression suite needed.
    - **Tier 2:** Basic regression suite covering main workflows.
    - **Tier 3:** Comprehensive regression suite with automated runs in CI.
- **Manual testing**
  - Automated tests can't catch everything (UX issues, visual bugs, unexpected interactions).
  - Guidelines:
    - **Tier 1:** Manual smoke test if you remember; not required.
    - **Tier 2:** Manual testing of key workflows before releases; brief exploratory testing.
    - **Tier 3:** Mandatory manual testing checklist; scheduled exploratory testing sessions; user acceptance testing (UAT) where applicable.
  - Use manual testing for:
    - Exploratory testing (poking around to find unexpected issues).
    - Visual regression (does it look right?).
    - Complex user flows that are hard to automate.
    - Edge cases in UI/UX that automated tests miss.
  - Document manual test scenarios:
    - Keep a simple checklist in Notion or your project repo.
    - Update it when new features are added or bugs are found.

---

## 7. Tools & Setup

### 7.1 Check My Code (CMC)

> 🛠 Purpose: enforce org-wide coding standards via a single config + CLI.

- NPM package: **`check-my-code`** (CMC).
- Central `cmc.toml` config holds:
  - Linting rules (e.g. Python, TypeScript).
  - Formatting rules.
  - Type-safety rules.
  - Org prompts for coding agents.
  - MCP servers to use.
- Supports **tiers**:
  - Prototype / internal / production.
- CLI supports:
  - `check` – verify config + run linters.
  - Generate linter configs.
  - Audit existing linters.
  - Pull shared prompts into project.

**Usage expectations**

- New projects use the **org CMC config** from day one.
- Old projects gradually migrated to CMC where it makes sense.

---

### 7.2 Context 7 (MCP server)

> 📚 Purpose: keep libraries and SDK usage up-to-date and less hallucination-prone.

- Remote MCP server providing:
  - Latest documentation & examples for many libraries.
- Recommended usage:
  - Install & configure Context 7.
  - Explicitly tell agents:
    - “Use Context 7 to validate any assumptions about this library.”
- Caveats:
  - May sometimes fetch **old package names**.
  - Always pair with tests and sanity checks.

---

### 7.3 Finchly

> 🧱 Purpose: knowledge backbone & MCP discovery.

- Features:
  - **MCP leaderboard** – what tools our team actually uses and likes.
  - **Custom forms / rotating questions** – Slack pings for weekly reflections, feeding into docs.
  - **Doc generation** – can turn transcripts (like this workshop) into posts/wiki entries.

**How we use it**

- Discover & standardise on good MCP servers.
- Capture weekly “what I learned about AI coding”.
- Generate internal docs from expert brain dumps (e.g. Luan’s architecture checklist).

---

### 7.4 Other tools

- **Cursor** – AI coding IDE (early wins: 2-week prototype for Global / Apple).
- **GitHub CLI** – preferred over GitHub MCP integration for many tasks.
- **Doppler** – secrets management; use `doppler run` for local dev.
- **CodeRabbit / GitHub PR review** – AI review; use where it helps, not blindly.
- **Warp** – AI terminal; use with AI features disabled unless we’re comfortable with its data handling.
- **Antigravity** – internal tool; currently crashy, handle with care.
- **Docker MCP** – extremely powerful, treat as high-risk (host-level access).

---

## 8. AI Usage Patterns & Pro Tips

### 8.1 Priming > zero-shot

- Don’t open with the “hot word” (controversial topics, tricky library name, etc).
- Build context first:
  - Discuss concepts, patterns, existing methods.
  - Only then introduce the specific problem.

### 8.2 Roundtables & multi-model checks

- “Roundtable” pattern:
  - Ask the model to simulate several experts discussing your problem.
- Multi-model pattern:
  - Give the same prompt to Claude, GPT, Gemini, etc.
  - Compare outputs; identify overlaps and disagreements.

### 8.3 Orchestration ideas

- Long-term goal:
  - Orchestrator that:
    - Receives a problem.
    - Fan-outs to multiple agents.
    - Aggregates responses.
- Short-term workaround:
  - Use multiple terminals/tabs with Claude Code and copy/paste between them.

### 8.4 Managing context

- When things feel “off”:
  - Export relevant notes/docs.
  - Clean them manually.
  - Start a fresh session with only what you want present.
- Don’t be afraid to abandon polluted sessions.

### 8.5 Discovering missing tools

- Ask the agent:
  - “What CLI tools would an effective dev in my stack usually have installed that you don’t see here?”
- Install what makes sense (AWS CLI, jq, etc.) to empower the agent and yourself.

---

## 9. Security & Secrets

### 9.1 Threat model basics

- Assume:
  - Anything on your machine could be read by an agent.
  - Anything sent to a remote AI can be logged or used in training (unless contractually guaranteed otherwise).

### 9.2 Keys & secrets

- Prefer:
  - **SSO sessions** for cloud access.
  - Short-lived, **least-privilege** API keys where necessary.
- Avoid:
  - Storing admin-level keys in reachable files.
  - Committing secrets to repos (even private).

### 9.3 Secrets management tools

- Use **Doppler** (or equivalent):
  - `doppler run` wraps commands with necessary env vars at runtime.
  - Agents don’t see secrets unless they explicitly run the command.

### 9.4 Limiting agent capabilities

- Configure AI tools (e.g. Claude Code) to:
  - Block dangerous commands at **system level**:
    - Repo deletion.
    - Dangerous Docker operations.
    - `rm -rf` type commands.
  - Restrict which directories they can roam in where supported.

### 9.5 Powerful MCP servers

- Treat Docker MCP and similar as **high risk**:
  - Access to Docker can ≈ access to host.
- Only enable after:
  - Clear threat model.
  - Extra safeguards in place.

---

## 10. Rituals & Processes

### 10.1 AI Coding Workshops

- **Cadence:** e.g. monthly or bi-weekly.
- **Format:**
  - Demo of a tool or workflow (e.g. CMC, Context 7 use cases).
  - Sharing architecture patterns & gotchas.
  - Group Q&A.

### 10.2 Weekly Learning Capture (Finchley)

- **Setup idea:**
  - Every Friday, Slack ping from Finchley asking:
    - “What did you learn about AI coding this week?”
    - “Any new risks or gotchas?”
    - “Any tools or tricks worth sharing?”
  - Answers go into a central Notion/Finchley page.
- Use this as a pipeline for:
  - Updating this playbook.
  - Writing internal blog posts.

### 10.3 Maintaining this page

- **Owner:** _(fill in)_
- **Update frequency:** adjust after each major workshop or when practices change.
- When something proves useful more than once:
  - Add it here.
  - Or spin it out into a dedicated subpage (e.g. “Testing Patterns” or “Security Playbook”).

---

## 11. Open Questions & Next Experiments

> 💭 Things we’re still exploring

- How formal should our “AI coding program” be?
  - Do we allocate ~20% time to improving the loop?
  - Do we assign explicit owners for:
    - Testing & coverage.
    - Observability.
    - AI tooling & MCPs.
    - Security.
- What are our **official default stacks**?
  - Python services → FastAPI?
  - Frontend frameworks & state management?
  - Default test frameworks?
- How far do we push **multi-agent orchestration**?
  - When is it actually better than one strong agent with good prompts?

---

## 12. Immediate To‑Dos (Draft)

You can convert these into a Notion checklist / task DB.

- [ ] Share `check-my-code` npm link + demo repo in the AI Coding channel.
- [ ] Publish a starter `CMC.toml` with Tier 1–3 standards.
- [ ] Document Context 7 setup & basic usage pattern.
- [ ] Configure Claude Code system-level blocked commands and share an example JSON.
- [ ] Set up Finchley weekly Slack questions for AI coding learnings.
- [ ] Create a small ADR database in Notion and link it here.
- [ ] Decide target coverage & testing expectations per tier and add them to this page.
- [ ] Schedule the next AI coding workshop.

---
