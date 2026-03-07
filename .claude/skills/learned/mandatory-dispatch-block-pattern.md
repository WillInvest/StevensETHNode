# MANDATORY DISPATCH Block Pattern

**Extracted:** 2026-03-05
**Context:** Enforcing Agent tool delegation from slash command files

## Problem

Command `.md` files that say "invokes the X agent" without any executable instruction are treated as documentation. Claude reads them and answers inline, consuming main context instead of delegating to a subagent.

## Solution

Add a `## MANDATORY DISPATCH INSTRUCTION` block at the **top** of the command file (before any instructional content). The block must include explicit, step-by-step instructions to call the Agent tool.

## Template

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

## Placement

The block must appear **before** any instructional content in the file:

```
[optional YAML frontmatter]

## MANDATORY DISPATCH INSTRUCTION   ← HERE, at the top
...

# Command Title
[rest of instructional content...]
```

## Why It Works

The dispatch block gives Claude an explicit, imperative instruction with numbered steps. Without it, Claude treats the command file as reference material and follows its own judgment (usually answering inline). With it, the instruction is unambiguous and Claude follows it reliably.

## When to Use

Apply this pattern when:
- Creating a new slash command that should delegate to a subagent
- A command is answering inline instead of dispatching
- Auditing existing commands for dispatch enforcement

## Commands Using This Pattern

- `.claude/commands/tdd.md` → `tdd-guide`
- `.claude/commands/plan.md` → `planner`
- `.claude/commands/e2e.md` → `e2e-runner`
- `.claude/commands/code-review.md` → `code-reviewer`
- `.claude/commands/build-fix.md` → `build-error-resolver`
- `.claude/commands/refactor-clean.md` → `refactor-cleaner`
- `.claude/commands/update-docs.md` → `doc-updater`
- `.claude/commands/security-review.md` → `security-reviewer`
- `.claude/commands/architect.md` → `architect`
