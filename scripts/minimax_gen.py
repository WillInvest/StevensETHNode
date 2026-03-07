#!/usr/bin/env python3
"""MiniMax M2.5 code generation helper.

Usage:
    # From prompt string
    python3 scripts/minimax_gen.py --prompt "Generate a React component..." --output path/to/file.jsx

    # From prompt file
    python3 scripts/minimax_gen.py --prompt-file prompt.txt --output path/to/file.jsx

    # With reference file context
    python3 scripts/minimax_gen.py --prompt "Create similar to reference..." --ref path/to/ref.jsx --output out.jsx

    # Print to stdout (no --output)
    python3 scripts/minimax_gen.py --prompt "Hello"
"""

import argparse
import json
import os
import re
import sys
import urllib.request


def load_api_key():
    """Load MiniMax API key from .env.minimax file."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.minimax")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("MINIMAX_API_KEY="):
                    return line.split("=", 1)[1]
    return os.environ.get("MINIMAX_API_KEY")


def call_minimax(prompt: str, max_tokens: int = 16000) -> str:
    """Call MiniMax M2.5 via Anthropic-compatible API."""
    api_key = load_api_key()
    if not api_key:
        print("Error: No MINIMAX_API_KEY found in .env.minimax or environment", file=sys.stderr)
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
        print(f"MiniMax API error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)

    # Extract text content
    text = next(
        (b["text"] for b in data.get("content", []) if b.get("type") == "text"),
        "",
    )

    # Strip markdown code fences if present
    text = re.sub(r"^```(?:jsx?|tsx?|python|py|css|html|sql|bash|sh)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)

    # Print token usage to stderr
    usage = data.get("usage", {})
    print(
        f"[MiniMax] in={usage.get('input_tokens', '?')} out={usage.get('output_tokens', '?')} tokens",
        file=sys.stderr,
    )

    return text


def main():
    parser = argparse.ArgumentParser(description="Generate code via MiniMax M2.5")
    parser.add_argument("--prompt", "-p", help="Prompt string")
    parser.add_argument("--prompt-file", "-f", help="Read prompt from file")
    parser.add_argument("--ref", "-r", help="Reference file to include in prompt")
    parser.add_argument("--output", "-o", help="Output file (stdout if omitted)")
    parser.add_argument("--max-tokens", "-t", type=int, default=16000, help="Max output tokens")
    args = parser.parse_args()

    # Build prompt
    if args.prompt_file:
        with open(args.prompt_file) as f:
            prompt = f.read()
    elif args.prompt:
        prompt = args.prompt
    else:
        prompt = sys.stdin.read()

    # Add reference file context
    if args.ref:
        with open(args.ref) as f:
            ref_content = f.read()
        prompt = f"Reference file ({args.ref}):\n\n{ref_content}\n\n---\n\n{prompt}"

    result = call_minimax(prompt, max_tokens=args.max_tokens)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w") as f:
            f.write(result)
        print(f"[MiniMax] Written to {args.output}", file=sys.stderr)
    else:
        print(result)


if __name__ == "__main__":
    main()
