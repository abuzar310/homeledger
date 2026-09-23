#!/bin/sh
# Audit HomeLedger with Auriti-Labs/geo-optimizer-skill (best-starred AEO checker on GitHub).
# https://github.com/Auriti-Labs/geo-optimizer-skill
set -e
URL="${1:-https://house-exp.vercel.app}"
if ! command -v geo >/dev/null 2>&1; then
  python3 -m pip install --user -q geo-optimizer-skill
  export PATH="$HOME/.local/bin:$PATH"
fi
geo audit --url "$URL" --format text
