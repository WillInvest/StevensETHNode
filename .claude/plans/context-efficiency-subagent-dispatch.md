# Plan: Context Efficiency via Subagent Dispatch

## Status: PENDING IMPLEMENTATION

## Background

Commands `/plan`, `/tdd`, `/e2e`, `/go-build`, `/go-review`, `/python-review` were
updated to include MANDATORY DISPATCH INSTRUCTIONs that force the `Agent` tool call
instead of answering inline. This plan extends that pattern to the remaining commands.

**Root cause of the original problem:** Command `.md` files said "invokes the X agent"
but contained no executable instruction. Claude read them as documentation and responded
inline, wasting main context. Fix: add a `## MANDATORY DISPATCH INSTRUCTION` block with
explicit `Agent` tool call steps at the top of each command file.

**Goal:** Subagents run in isolated contexts → main conversation window stays clean.

---

## Phase 1: Add MANDATORY DISPATCH to 4 Existing Commands

### 1. `/code-review` → `code-reviewer` (Sonnet)
File: `.claude/commands/code-review.md`
- Add MANDATORY DISPATCH block at top
- Dispatch to `subagent_type: "code-reviewer"`

### 2. `/build-fix` → `build-error-resolver` (Haiku)
File: `.claude/commands/build-fix.md`
- Add MANDATORY DISPATCH block at top
- Dispatch to `subagent_type: "build-error-resolver"`
- Note: Haiku is sufficient for mechanical build error fixing (~60% cost savings)

### 3. `/refactor-clean` → `refactor-cleaner` (Sonnet)
File: `.claude/commands/refactor-clean.md`
- Add MANDATORY DISPATCH block at top
- Dispatch to `subagent_type: "refactor-cleaner"`

### 4. `/update-docs` → `doc-updater` (Haiku)
File: `.claude/commands/update-docs.md`
- Add MANDATORY DISPATCH block at top
- Dispatch to `subagent_type: "doc-updater"`
- Note: Haiku sufficient for doc generation (~70% cost savings)

---

## Phase 2: Create 2 Missing Command Files

Agents exist but have no corresponding slash command.

### 5. Create `/security-review` → `security-reviewer` (Opus)
File: `.claude/commands/security-review.md` (CREATE NEW)
- New command file with MANDATORY DISPATCH block
- Dispatch to `subagent_type: "security-reviewer"`
- Opus justified: security review requires deep reasoning

### 6. Create `/architect` → `architect` (Opus)
File: `.claude/commands/architect.md` (CREATE NEW)
- New command file with MANDATORY DISPATCH block
- Dispatch to `subagent_type: "architect"`
- Opus justified: architectural decisions require deep reasoning

---

## Phase 3: Workspace Config Changes

### 7. Update `.claude/settings.json`
Add `lazyLoadAgents` to defer agent context loading until command is actually invoked:
```json
{
  "lazyLoadAgents": {
    "enabled": true,
    "agents": [
      { "subagent_type": "code-reviewer",        "loadOn": "/code-review" },
      { "subagent_type": "build-error-resolver",  "loadOn": "/build-fix" },
      { "subagent_type": "refactor-cleaner",      "loadOn": "/refactor-clean" },
      { "subagent_type": "doc-updater",           "loadOn": "/update-docs" },
      { "subagent_type": "security-reviewer",     "loadOn": "/security-review" },
      { "subagent_type": "architect",             "loadOn": "/architect" }
    ]
  }
}
```

### 8. Update `CLAUDE.md` — Add Dispatch Strategy Table
Add a "Dispatch Strategy" section to `.claude/CLAUDE.md` (not project CLAUDE.md):

```markdown
## Dispatch Strategy: Context Efficiency

| Command           | Agent                  | Model  | Purpose                  |
|-------------------|------------------------|--------|--------------------------|
| /plan             | planner                | Opus   | Implementation planning  |
| /tdd              | tdd-guide              | Sonnet | Test-driven development  |
| /e2e              | e2e-runner             | Sonnet | End-to-end testing       |
| /code-review      | code-reviewer          | Sonnet | Code quality review      |
| /security-review  | security-reviewer      | Opus   | Security auditing        |
| /architect        | architect              | Opus   | System design            |
| /build-fix        | build-error-resolver   | Haiku  | Build error fixes        |
| /refactor-clean   | refactor-cleaner       | Sonnet | Dead code removal        |
| /update-docs      | doc-updater            | Haiku  | Documentation sync       |
| /go-build         | go-build-resolver      | Haiku  | Go build fixes           |
| /go-review        | go-reviewer            | Sonnet | Go code review           |
| /python-review    | python-reviewer        | Sonnet | Python code review       |
```

---

## Commands That Should NOT Dispatch

These are intentionally inline — they are lightweight, already orchestrators, or
system-level commands that don't benefit from context isolation:

- `/loop-*` (checkpoint, status, start) — session orchestration, minimal context
- `/claw` — REPL launcher
- `/instinct-*` (export, import, status, promote) — lightweight metadata ops
- `/pm2`, `/sessions` — system management
- `/eval`, `/learn`, `/learn-eval` — experiment/pattern tracking, inline is fine
- `/multi-*` — already multi-agent orchestrators themselves
- `/orchestrate` — already a dispatcher
- `/projects`, `/evolve` — lightweight metadata

---

## MANDATORY DISPATCH Block Template

Use this exact format when adding to command files:

```markdown
## MANDATORY DISPATCH INSTRUCTION

You MUST use the `Agent` tool to delegate this task. Do NOT answer as the <agent-name> yourself.

Steps:
1. Load the Agent tool via `ToolSearch` if not yet available (`select:Agent`)
2. Call `Agent` with `subagent_type: "<agent-name>"` and pass the user's full request as the prompt
3. Relay the agent's output back to the user verbatim

**Never skip the Agent tool call. Always delegate.**

---
```

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Commands with dispatch | 6 | 12 |
| Main context savings per session | baseline | ~30-50% |
| Token cost (build-fix, update-docs) | Sonnet rate | ~60-70% cheaper via Haiku |
| Lazy load savings | 0% | ~15-25% |

---

## Files to Modify

| File | Action |
|------|--------|
| `.claude/commands/code-review.md` | Add MANDATORY DISPATCH |
| `.claude/commands/build-fix.md` | Add MANDATORY DISPATCH |
| `.claude/commands/refactor-clean.md` | Add MANDATORY DISPATCH |
| `.claude/commands/update-docs.md` | Add MANDATORY DISPATCH |
| `.claude/commands/security-review.md` | CREATE NEW |
| `.claude/commands/architect.md` | CREATE NEW |
| `.claude/settings.json` | Add lazyLoadAgents |
| `.claude/CLAUDE.md` | Add dispatch strategy table |

---

## Success Criteria

- [ ] All 12 dispatch commands have MANDATORY DISPATCH blocks
- [ ] 2 new command files created (security-review, architect)
- [ ] settings.json updated with lazyLoadAgents
- [ ] CLAUDE.md updated with dispatch strategy table
- [ ] Main context stays below 60% on a typical session
