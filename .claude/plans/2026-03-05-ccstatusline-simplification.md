# Implementation Plan: Simplify ccstatusline Status Line Output

**Project**: /home/stevensbc/stevens-blockchain/ccstatusline
**Created**: 2026-03-05
**Status**: Awaiting confirmation

---

## Requirements

Display only 5 core pieces of information:
1. **Model name** — which Claude model is active
2. **Subagent info** — current subagent (if applicable)
3. **Skills** — active skills count/list
4. **Context progress bar** — visual bar + percentage of context window used
5. **Git repo name** — basename only (e.g., `stevens-blockchain`)

---

## Key Files

| File | Change |
|------|--------|
| `src/types/Settings.ts` | Update default `lines` array |
| `src/widgets/GitRepoName.ts` | Create (if GitRootDir shows full path) |
| `src/utils/widget-manifest.ts` | Register new widget (if created) |
| `scripts/payload.example.json` | Update example payload for testing |

---

## Implementation Phases

### Phase 1: Audit Existing Widgets
- Read `src/widgets/Model.ts` — confirm output format
- Read `src/widgets/SkillsWidget.ts` — verify it exists and output
- Read `src/widgets/ContextBarPercentage.ts` — confirm bar + % format
- Read `src/widgets/GitRootDir.ts` — check if it outputs full path or just name

### Phase 2: Update Default Configuration (1 file)
Modify `src/types/Settings.ts` default `lines` array:

```typescript
// BEFORE (7 widgets):
[
    { id: '1', type: 'model', color: 'cyan' },
    { id: '2', type: 'separator' },
    { id: '3', type: 'context-length', color: 'brightBlack' },
    { id: '4', type: 'separator' },
    { id: '5', type: 'git-branch', color: 'magenta' },
    { id: '6', type: 'separator' },
    { id: '7', type: 'git-changes', color: 'yellow' }
]

// AFTER (5 widgets):
[
    { id: '1', type: 'model', color: 'cyan' },
    { id: '2', type: 'separator', color: 'gray' },
    { id: '3', type: 'skills', color: 'yellow' },
    { id: '4', type: 'separator', color: 'gray' },
    { id: '5', type: 'context-bar-percentage', color: 'blue' },
    { id: '6', type: 'separator', color: 'gray' },
    { id: '7', type: 'git-repo-name', color: 'magenta' }
]
```

### Phase 3: Git Repo Name Widget (Conditional)
If `GitRootDir.ts` outputs full path, create `src/widgets/GitRepoName.ts`:
- Reuse git command from `GitRootDir.ts`
- Extract basename with `path.basename()`
- Fallback: show `~` if not in git repo
- Register in `src/utils/widget-manifest.ts`

### Phase 4: Test
- Update `scripts/payload.example.json` with realistic data
- Run `bun run example` — visually inspect output
- Run `bun test` — verify no regressions

### Phase 5: Color & Styling Refinement
Adjust colors per widget:
- `model` → `cyan`
- `skills` → `yellow`
- `context-bar-percentage` → `blue`
- `git-repo-name` → `magenta`
- `separator` → `gray`

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Skills widget doesn't exist | High | Create minimal widget in Phase 1 if needed |
| Context bar too wide for 80-col terminals | Medium | Test on narrow terminals; use compact format |
| Git repo name fails in non-git dirs | Low | Fallback to `~` |

---

## Success Criteria

- [ ] Default renders: `Model | Skills | [====>    ] 65% | stevens-blockchain`
- [ ] Fits single line on 120-col terminal
- [ ] `bun test` passes
- [ ] TUI still functional for customization
- [ ] Custom user settings unaffected (backward compatible)

---

## Commit Message

```
feat(ccstatusline): simplify default status line to 5 core widgets

Show only: model, skills, context progress bar, and git repo name.
Removes git-branch, git-changes, and context-length count from defaults.
Custom user configurations are preserved and fully backward compatible.
```
