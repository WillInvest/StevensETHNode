# Slash Command vs Skill Tool — Invocation Path Clarification

**Extracted:** 2026-03-05
**Context:** Diagnosing why a slash command isn't dispatching to a subagent

## Problem

When a slash command (e.g. `/tdd`) fails to delegate to a subagent, the temptation is to look at skill files (e.g. `tdd-workflow/SKILL.md`) as the culprit. This is a misdiagnosis — slash commands and skills are completely separate invocation paths.

## Solution

Understand the two distinct paths:

| Invocation | Reads | Example |
|------------|-------|---------|
| `/tdd` CLI slash command | `.claude/commands/tdd.md` | User types `/tdd` in Claude Code |
| Skill tool | `.claude/skills/tdd-workflow/SKILL.md` | Claude explicitly calls `Skill("tdd-workflow")` |

These paths **never cross automatically**. The `/tdd` CLI command will never read a skill file. Skills are only invoked when Claude explicitly decides to call the Skill tool.

## Diagnosis Checklist

When a slash command isn't dispatching:
1. Check `.claude/commands/<command>.md` — does it have a MANDATORY DISPATCH block?
2. Is the MANDATORY DISPATCH block at the **top** of the file (before instructional content)?
3. Is the command file even being read? (check for typos in filename)
4. Skill files are irrelevant to slash command dispatch — don't chase them

## When to Use

Apply this pattern when:
- Diagnosing why a slash command answers inline instead of delegating
- Someone suggests fixing skill files to fix a slash command dispatch issue
- Auditing command vs skill coverage for agent dispatch
