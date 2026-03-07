#!/usr/bin/env python3
"""MiniMax + Gemini pipeline: Generate code with MiniMax, review with Gemini.

Workflow:
  1. MiniMax M2.5 generates code from prompt
  2. Gemini reviews the output for bugs, quality, project conventions
  3. If issues found, MiniMax regenerates with Gemini's feedback
  4. Final output written to file

Usage:
    # Generate and review
    python3 scripts/minimax_pipeline.py -p "Generate a React component..." -o path/to/file.jsx

    # With reference file
    python3 scripts/minimax_pipeline.py -p "Create similar..." -r ref.jsx -o out.jsx

    # Skip review (just MiniMax)
    python3 scripts/minimax_pipeline.py -p "..." -o out.jsx --no-review

    # Gemini-driven mode: Gemini decides what to generate, dispatches to MiniMax
    python3 scripts/minimax_pipeline.py --gemini-driven -p "I need a sidebar component for..." -o out.jsx
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEMINI_BIN = "/usr/bin/gemini"
GEMINI_MODEL = "gemini-3.1-pro-preview"
GEMINI_FALLBACK = "gemini-2.5-pro"


# ── MiniMax API ──────────────────────────────────────────────────────

def load_minimax_key():
    env_path = os.path.join(PROJECT_ROOT, ".env.minimax")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("MINIMAX_API_KEY="):
                    return line.split("=", 1)[1]
    return os.environ.get("MINIMAX_API_KEY")


def call_minimax(prompt: str, max_tokens: int = 16000) -> str:
    api_key = load_minimax_key()
    if not api_key:
        print("[ERROR] No MINIMAX_API_KEY found", file=sys.stderr)
        sys.exit(1)

    url = "https://api.minimax.io/anthropic/v1/messages"
    payload = json.dumps({
        "model": "MiniMax-M2.5",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    })

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[MiniMax ERROR] {e.code}: {body}", file=sys.stderr)
        sys.exit(1)

    text = next(
        (b["text"] for b in data.get("content", []) if b.get("type") == "text"),
        "",
    )
    # Strip markdown fences
    text = re.sub(r"^```(?:jsx?|tsx?|python|py|css|html|sql|bash|sh)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)

    usage = data.get("usage", {})
    print(f"[MiniMax] in={usage.get('input_tokens','?')} out={usage.get('output_tokens','?')}", file=sys.stderr)
    return text


# ── Gemini CLI ───────────────────────────────────────────────────────

def call_gemini(prompt: str, stdin_text: str = None) -> str:
    """Call Gemini CLI. Falls back to gemini-2.5-pro on 429."""
    for model in [GEMINI_MODEL, GEMINI_FALLBACK]:
        try:
            result = subprocess.run(
                [GEMINI_BIN, "-m", model, "-p", prompt],
                input=stdin_text,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode == 0:
                print(f"[Gemini] model={model}", file=sys.stderr)
                return result.stdout.strip()
            if "429" in result.stderr:
                print(f"[Gemini] 429 on {model}, falling back...", file=sys.stderr)
                continue
            # Other error
            print(f"[Gemini ERROR] {result.stderr[:200]}", file=sys.stderr)
            return result.stdout.strip() or result.stderr.strip()
        except subprocess.TimeoutExpired:
            print(f"[Gemini] timeout on {model}", file=sys.stderr)
            continue

    print("[Gemini] all models failed", file=sys.stderr)
    return ""


# ── Pipeline ─────────────────────────────────────────────────────────

REVIEW_PROMPT = """Review this generated code for a blockchain analytics dashboard (React + Tailwind v4 dark theme).

Check for:
1. Bugs or logic errors
2. Missing imports or undefined references
3. Broken JSX syntax
4. Incorrect CSS variable names (should use --bg-card, --text-primary, --accent, --font-mono, etc.)
5. Non-functional components (missing return, bad hooks usage)
6. Security issues (XSS, injection)

Project conventions:
- React functional components with hooks
- CSS variables from index.css (not inline colors)
- font-family: var(--font-mono) for numbers, var(--font-body) for text
- Dark theme: bg #0c0d14, cards #14151f, text #f0f0f5
- Imports: react-router-dom for navigation, recharts for charts

Respond in this exact format:
VERDICT: PASS or FAIL
ISSUES: (list each issue on its own line, or "None" if PASS)
FIXES: (for each issue, the specific fix needed, or "None" if PASS)"""

REVISION_PROMPT_TEMPLATE = """The code you generated has issues found during review. Fix ALL of them and output the complete corrected file.

ISSUES FOUND:
{issues}

ORIGINAL CODE:
{code}

Output ONLY the corrected code. No markdown fences, no explanation."""


def run_pipeline(prompt: str, ref_file: str = None, output: str = None,
                 no_review: bool = False, max_rounds: int = 2):
    """Generate with MiniMax, review with Gemini, optionally revise."""

    # Build full prompt
    full_prompt = prompt
    if ref_file:
        with open(ref_file) as f:
            ref_content = f.read()
        full_prompt = f"Reference file ({ref_file}):\n\n{ref_content}\n\n---\n\n{prompt}"

    # Step 1: MiniMax generates
    print("[Pipeline] Step 1: MiniMax generating...", file=sys.stderr)
    code = call_minimax(full_prompt)

    if not code.strip():
        print("[Pipeline] MiniMax returned empty output", file=sys.stderr)
        sys.exit(1)

    if no_review:
        return _write_output(code, output)

    # Step 2: Gemini reviews
    for round_num in range(max_rounds):
        print(f"[Pipeline] Step 2: Gemini reviewing (round {round_num + 1})...", file=sys.stderr)
        review = call_gemini(REVIEW_PROMPT, stdin_text=code)

        if not review:
            print("[Pipeline] Gemini review unavailable, using MiniMax output as-is", file=sys.stderr)
            break

        # Parse verdict
        verdict_match = re.search(r"VERDICT:\s*(PASS|FAIL)", review, re.IGNORECASE)
        verdict = verdict_match.group(1).upper() if verdict_match else "UNKNOWN"

        print(f"[Pipeline] Gemini verdict: {verdict}", file=sys.stderr)

        if verdict == "PASS":
            print("[Pipeline] Code passed Gemini review", file=sys.stderr)
            break

        # Extract issues for revision
        issues_match = re.search(r"ISSUES:\s*(.+?)(?:FIXES:|$)", review, re.DOTALL)
        fixes_match = re.search(r"FIXES:\s*(.+?)$", review, re.DOTALL)
        issues_text = issues_match.group(1).strip() if issues_match else review
        fixes_text = fixes_match.group(1).strip() if fixes_match else ""

        feedback = issues_text
        if fixes_text and fixes_text.lower() != "none":
            feedback += "\n\nSuggested fixes:\n" + fixes_text

        # Step 3: MiniMax revises
        print(f"[Pipeline] Step 3: MiniMax revising with feedback...", file=sys.stderr)
        revision_prompt = REVISION_PROMPT_TEMPLATE.format(issues=feedback, code=code)
        code = call_minimax(revision_prompt)

    return _write_output(code, output)


def run_gemini_driven(prompt: str, output: str = None):
    """Gemini decides the spec, dispatches to MiniMax, then reviews."""

    print("[Pipeline] Gemini-driven mode: Gemini creating spec...", file=sys.stderr)

    spec_prompt = f"""You are a senior frontend architect for a blockchain analytics dashboard.
The project uses: React 18, Recharts, TanStack Table, Tailwind v4, dark theme (bg: #0c0d14).
CSS variables: --bg-card, --bg-primary, --text-primary, --text-secondary, --accent (#6366f1), --font-mono, --font-body.

The user wants: {prompt}

Write a DETAILED specification for a coding agent to implement this. Include:
1. Exact imports needed
2. Component structure (props, state, hooks)
3. JSX layout description
4. CSS classes to use
5. Data fetching pattern (fetch from /api/...)
6. Any edge cases to handle

Be very specific — the coding agent will follow your spec literally.
End with: "Output ONLY the complete code file, no markdown fences, no explanation." """

    spec = call_gemini(spec_prompt)
    if not spec:
        print("[Pipeline] Gemini spec generation failed, falling back to direct MiniMax", file=sys.stderr)
        return run_pipeline(prompt, output=output)

    print(f"[Pipeline] Gemini spec ready ({len(spec)} chars), dispatching to MiniMax...", file=sys.stderr)

    # MiniMax implements the spec
    code = call_minimax(spec)

    # Gemini reviews
    print("[Pipeline] Gemini reviewing MiniMax output...", file=sys.stderr)
    review = call_gemini(REVIEW_PROMPT, stdin_text=code)

    if review:
        verdict_match = re.search(r"VERDICT:\s*(PASS|FAIL)", review, re.IGNORECASE)
        verdict = verdict_match.group(1).upper() if verdict_match else "UNKNOWN"
        print(f"[Pipeline] Gemini verdict: {verdict}", file=sys.stderr)

        if verdict == "FAIL":
            issues_match = re.search(r"ISSUES:\s*(.+?)(?:FIXES:|$)", review, re.DOTALL)
            fixes_match = re.search(r"FIXES:\s*(.+?)$", review, re.DOTALL)
            feedback = (issues_match.group(1).strip() if issues_match else review)
            fixes_text = fixes_match.group(1).strip() if fixes_match else ""
            if fixes_text and fixes_text.lower() != "none":
                feedback += "\n\nSuggested fixes:\n" + fixes_text

            print("[Pipeline] MiniMax revising with Gemini feedback...", file=sys.stderr)
            revision_prompt = REVISION_PROMPT_TEMPLATE.format(issues=feedback, code=code)
            code = call_minimax(revision_prompt)

    return _write_output(code, output)


def _write_output(code: str, output: str = None):
    """Write code to file or stdout."""
    if output:
        os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
        with open(output, "w") as f:
            f.write(code)
        print(f"[Pipeline] Written to {output}", file=sys.stderr)
    else:
        print(code)
    return code


def main():
    parser = argparse.ArgumentParser(description="MiniMax + Gemini code generation pipeline")
    parser.add_argument("--prompt", "-p", help="Generation prompt")
    parser.add_argument("--prompt-file", "-f", help="Read prompt from file")
    parser.add_argument("--ref", "-r", help="Reference file to include")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--no-review", action="store_true", help="Skip Gemini review")
    parser.add_argument("--gemini-driven", action="store_true",
                        help="Gemini creates spec, MiniMax implements, Gemini reviews")
    parser.add_argument("--max-rounds", type=int, default=2, help="Max review/revision rounds")
    args = parser.parse_args()

    if args.prompt_file:
        with open(args.prompt_file) as f:
            prompt = f.read()
    elif args.prompt:
        prompt = args.prompt
    else:
        prompt = sys.stdin.read()

    if args.gemini_driven:
        run_gemini_driven(prompt, output=args.output)
    else:
        run_pipeline(prompt, ref_file=args.ref, output=args.output,
                     no_review=args.no_review, max_rounds=args.max_rounds)


if __name__ == "__main__":
    main()
