#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Area11 - Master Spec Sync
# ---------------------------------------------------------------------------
# Kaam: INPUT-INFORMATION.md ke "PART 1" wale hisse ko master spec file se
# HAMESHA bilkul match rakhta hai (copy-paste, hoo-ba-hoo).
#
# Kyun?  Taake do jagah likha hua material kabhi aapas mein farq (drift) na kare.
#        Jab bhi master spec file badle, sirf yeh chala dein -- PART 1 khud
#        update ho jayega. Baqi document (PART 2 aur baaki sab) waisa hi rahega.
#
# RUN:  bash scripts/sync-spec.sh
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOC="INPUT-INFORMATION.md"
BEGIN_MARK="<!-- BEGIN: SPEC-VERBATIM -->"
END_MARK="<!-- END: SPEC-VERBATIM -->"

# --- master spec file dhoondo -----------------------------------------------
SPEC="${1:-}"
if [ -z "$SPEC" ]; then
  SPEC="$(find . -maxdepth 2 -name 'complete_numbered_master_specs*.md' \
          -not -path './.git/*' | head -1 | sed 's|^\./||')"
fi

[ -n "$SPEC" ] && [ -f "$SPEC" ] || { echo "[error] Master spec file nahi mili." >&2; exit 1; }
[ -f "$DOC" ] || { echo "[error] ${DOC} nahi mili." >&2; exit 1; }

grep -qF "$BEGIN_MARK" "$DOC" || { echo "[error] BEGIN marker nahi mila: $BEGIN_MARK" >&2; exit 1; }
grep -qF "$END_MARK"   "$DOC" || { echo "[error] END marker nahi mila: $END_MARK" >&2; exit 1; }

# --- naya document banao ----------------------------------------------------
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

awk -v begin="$BEGIN_MARK" -v end="$END_MARK" -v spec="$SPEC" '
  $0 == begin {
    print begin
    while ((getline line < spec) > 0) print line
    close(spec)
    skip = 1
    next
  }
  $0 == end { skip = 0 }
  skip != 1 { print }
' "$DOC" > "$TMP"

# --- agar waqai kuch badla ho tab hi likho -------------------------------
if cmp -s "$TMP" "$DOC"; then
  echo "[ok] PART 1 pehle se bilkul master spec ke mutabiq hai - koi tabdeeli nahi."
else
  cp "$TMP" "$DOC"
  LINES="$(wc -l < "$SPEC" | tr -d ' ')"
  BYTES="$(wc -c < "$SPEC" | tr -d ' ')"
  echo "[ok] PART 1 update ho gaya: '${SPEC}' (${LINES} lines, ${BYTES} bytes) hoo-ba-hoo ${DOC} mein."
fi
