# ccstatusline Configuration Patterns

Learned: 2026-03-05
Source: Session configuring advanced ccstatusline widgets

## Correct Widget Type Names

Several widget types have non-obvious names. Use these exact strings:

| Intended widget | CORRECT type | WRONG (silent fail) |
|----------------|--------------|---------------------|
| Block reset countdown | `reset-timer` | `block-reset-timer` |
| RAM usage display | `free-memory` | `memory-usage` |

Unknown widget types are silently skipped — no error is shown.

## flexMode Recommendations

- `"full"` — full terminal width; best for 100+ column terminals
- `"full-minus-40"` — reserves 40 chars for Claude auto-compact message (default, can over-truncate)
- `"full-until-compact"` — dynamic: full width below context threshold, shrinks above it

For 33 widgets across 3 lines, use `"full"` to avoid truncation.

## Nerd Font Installation (Ubuntu — apt fails)

`sudo apt install fonts-jetbrains-mono-nerd` is NOT a valid apt package on Ubuntu 24.04.

Use direct download instead:
```bash
mkdir -p ~/.local/share/fonts/jetbrains-nerd
cd ~/.local/share/fonts/jetbrains-nerd
curl -fLo "JetBrainsMono.zip" \
  "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip"
unzip -o "JetBrainsMono.zip" "*.ttf"
rm JetBrainsMono.zip
cd ~
fc-cache -fv
```

Verify:
```bash
fc-list | grep -i jetbrains
echo -e "\ue0b0\ue0b2"  # Should show arrows, not raw codes
```

## Config File Location

`/home/stevensbc/.config/ccstatusline/settings.json`

Widget source manifest: `/home/stevensbc/stevens-blockchain/ccstatusline/src/utils/widget-manifest.ts`

## Multi-Line Layout (33 widgets, 3 lines)

- Line 1: Model + Token Speeds (input/output/total) + Block Timer + Session Clock + Reset Timer + Context Length
- Line 2: Git Branch + Git Changes + Session Usage + Weekly Usage + Context % + Git Root Dir
- Line 3: Skills + Session Name + Context Bar + Free Memory
