#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Area11 - Checkpoint system  ("wapas jane ka system")
# ---------------------------------------------------------------------------
# Maqsad: har stage save rahe, aur kabhi bhi kisi bhi purane stage par
# wapas ja sakein -- aur kuch bhi hamesha ke liye zaya na ho.
#
# Technology: Git hi engine hai (naya code likhne ki zarurat nahi --
# mojood reverse-engineering ki gayi cheez istemal ho rahi hai).
# History LINEAR rehti hai: purana commit kabhi delete nahi hota, is liye
# "wapas jana" bhi ek naya commit banta hai. Natija: kuch bhi na-qabil-e-recovery
# nahi hota.
#
# ISTEMAL (RUN):
#   bash scripts/ckpt.sh save "kaam ka naam"    stage save karo (auto number)
#   bash scripts/ckpt.sh list                   saare stages dekho
#   bash scripts/ckpt.sh go 3                   stage 3 par jao
#   bash scripts/ckpt.sh undo                   pichle stage par jao
#   bash scripts/ckpt.sh diff 2                 stage 2 se ab tak kya badla
#   bash scripts/ckpt.sh status                 abhi ka haal
#   bash scripts/ckpt.sh push                   GitHub par mehfooz karo
# ---------------------------------------------------------------------------
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

TAG_PREFIX="stage-"
STATE_FILE=".ckpt-state"          # "abhi kaun se stage par hain" (git me track nahi hota)

C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'
C_HEAD=$'\033[36m'; C_BOLD=$'\033[1m'; C_OFF=$'\033[0m'

log()  { printf "${C_HEAD}[ckpt]${C_OFF} %s\n" "$*"; }
ok()   { printf "${C_OK}[ok]${C_OFF} %s\n" "$*"; }
warn() { printf "${C_WARN}[warn]${C_OFF} %s\n" "$*"; }
die()  { printf "${C_ERR}[error]${C_OFF} %s\n" "$*" >&2; exit 1; }

git rev-parse --git-dir >/dev/null 2>&1 || die "Yeh Git repo nahi hai."

# ---------------------------------------------------------------------------
# madad-gar functions
# ---------------------------------------------------------------------------

# Sab se bara stage number jo ab tak bana
max_stage_number() {
  local max
  max="$(git tag -l "${TAG_PREFIX}*" | sed "s/^${TAG_PREFIX}//" \
         | grep -E '^[0-9]+$' | sort -n | tail -1)"
  [ -z "$max" ] && echo 0 || echo "$max"
}

# Abhi kaun se stage par hain
current_stage_number() {
  local n
  n="$(cat "$STATE_FILE" 2>/dev/null | tr -d '[:space:]')"
  if [ -n "$n" ] && git rev-parse -q --verify "refs/tags/${TAG_PREFIX}${n}" >/dev/null; then
    echo "$n"; return 0
  fi
  echo "$(max_stage_number)"   # fallback: sab se naya stage
}

save_state() { echo "$1" > "$STATE_FILE"; }

is_dirty() { [ -n "$(git status --porcelain --untracked-files=normal)" ]; }

# SAFETY NET: maujooda haalat ko foran commit kar do (kuch bhi na khoye)
safety_snapshot() {
  local label="$1" ts
  ts="$(date '+%Y-%m-%d %H:%M')"
  if is_dirty; then
    git add -A >/dev/null 2>&1
    if git commit -q -m "snapshot (auto): ${label} @ ${ts}" >/dev/null 2>&1; then
      ok "Safety snapshot ban gaya (aap ka adhoora kaam mehfooz hai)."
    else
      warn "Snapshot commit nahi bana (shayad koi tabdeeli nahi thi)."
    fi
  else
    ok "Kuch bina-save kiya hua kaam nahi tha."
  fi
}

# "3" / "stage-3" / "stage-3^{}" -- sab ko ek ref bana do
resolve_ref() {
  local want="$1"
  if git rev-parse -q --verify "refs/tags/${TAG_PREFIX}${want}" >/dev/null 2>&1; then
    echo "${TAG_PREFIX}${want}"; return 0
  fi
  if git rev-parse -q --verify "refs/tags/${want}" >/dev/null 2>&1; then
    echo "${want}"; return 0
  fi
  if git rev-parse -q --verify "${want}^{commit}" >/dev/null 2>&1; then
    echo "$want"; return 0
  fi
  return 1
}

# Asli kaam: working tree ko kisi bhi stage/commit ki haalat par le jao
goto_ref() {
  local ref="$1" desc="$2"

  git checkout "$ref" -- . 2>/dev/null || die "Files restore nahi ho paayin."

  # jo files us waqt maujood hi nahi thin, unhe hatao
  local to_delete
  to_delete="$(git diff --name-only --diff-filter=D HEAD "$ref" 2>/dev/null)"
  if [ -n "$to_delete" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] && rm -f -- "$f"
    done <<< "$to_delete"
  fi

  git add -A >/dev/null 2>&1
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q -m "restore: ${desc}" >/dev/null 2>&1 \
      || warn "restore commit nahi bana."
  else
    warn "Content pehle se bilkul wahi tha (koi tabdeeli nahi)."
  fi
}

# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------

cmd_save() {
  local msg="${1:-}"
  [ -n "$msg" ] || die 'Pehle naam likhein:  bash scripts/ckpt.sh save "mera kaam"'

  local num tag
  num=$(( $(max_stage_number) + 1 ))
  tag="${TAG_PREFIX}${num}"

  if is_dirty; then
    git add -A >/dev/null 2>&1
    git commit -q -m "${msg}" || die "Commit fail ho gaya (config theek hai?)."
  else
    warn "Koi tabdeeli nahi mili - maujooda haalat par hi tag laga rahe hain."
  fi

  git tag -f -a "$tag" -m "${msg}" >/dev/null 2>&1 || die "Tag nahi bana."
  save_state "$num"

  printf "${C_OK}[ok]${C_OFF} ${C_BOLD}Stage %s save ho gaya${C_OFF}  ~  \"%s\"\n" "$num" "$msg"
  printf "     Pichle stage par jane ke liye:  bash scripts/ckpt.sh undo\n"
  printf "     GitHub par mehfooz karne ke liye: bash scripts/ckpt.sh push\n"
}

cmd_list() {
  local cur; cur="$(current_stage_number)"
  echo
  printf "${C_HEAD}=== AREA11 KE SAVE KIYE HUAY STAGES ===${C_OFF}\n"
  local found=0 t
  while read -r t; do
    [ -n "$t" ] || continue
    found=1
    local num when subj mark=""
    num="${t#${TAG_PREFIX}}"
    when="$(git log -1 --format=%ci "$t" 2>/dev/null | cut -d' ' -f1,2 | cut -d: -f1,2)"
    subj="$(git log -1 --format=%s "$t" 2>/dev/null)"
    [ "$num" = "$cur" ] && mark="   ${C_OK}<== AAP YAHAN HAIN${C_OFF}"
    printf "  ${C_BOLD}Stage %-3s${C_OFF} %s   %s%s\n" "$num" "$when" "$subj" "$mark"
  done < <(git tag -l "${TAG_PREFIX}*" | sed "s/^${TAG_PREFIX}//" | grep -E '^[0-9]+$' | sort -n | sed "s/^/${TAG_PREFIX}/")

  [ "$found" -eq 1 ] || warn "Abhi koi stage save nahi hua.  Pehla banane ke liye:  bash scripts/ckpt.sh save \"shuruat\""
  echo
  printf "${C_HEAD}=== AAKHRI 8 COMMITS (poori history mehfooz hai) ===${C_OFF}\n"
  git log --oneline -8 | sed 's/^/  /'
  echo
}

cmd_go() {
  local want="${1:-}"
  [ -n "$want" ] || die "Kaunsa stage?  Misal:  bash scripts/ckpt.sh go 3"

  local ref
  ref="$(resolve_ref "$want")" || die "Aisa koi stage nahi mila: '${want}'   (dekhein: bash scripts/ckpt.sh list)"

  local desc
  desc="$(git log -1 --format='%h %s' "$ref")"
  log "Wapas ja rahe hain -> ${C_BOLD}${want}${C_OFF} : ${desc}"

  safety_snapshot "'go ${want}' se pehle"
  goto_ref "$ref" "wapas '${want}' par (${desc})"

  # stage number yaad rakho
  case "$want" in
    "${TAG_PREFIX}"*) save_state "${want#${TAG_PREFIX}}" ;;
    [0-9]*)           save_state "$want" ;;
  esac

  printf "${C_OK}[ok]${C_OFF} ${C_BOLD}Ho gaya.${C_OFF} Ab aap '${want}' wali haalat par hain.\n"
  warn "Sab kuch mehfooz hai - kuch bhi zaya nahi hua."
  warn "Aage wapas aane ke liye:  bash scripts/ckpt.sh list  phir  bash scripts/ckpt.sh go <number>"
}

cmd_undo() {
  local cur target
  cur="$(current_stage_number)"
  target=$((cur - 1))

  if [ "$cur" -le 1 ]; then
    warn "Aap pehle hi sab se purane stage (Stage ${cur}) par hain - is se peeche kuch nahi."
    warn "Shayad aap aage jana chahte hain?  bash scripts/ckpt.sh go $((cur + 1))"
    return 0
  fi
  if ! git rev-parse -q --verify "refs/tags/${TAG_PREFIX}${target}" >/dev/null 2>&1; then
    warn "Stage ${target} maujood nahi. Maujooda stages: bash scripts/ckpt.sh list"
    return 0
  fi
  cmd_go "$target"
}

cmd_diff() {
  local want="${1:-}"
  [ -n "$want" ] || die "Kis stage se?  Misal:  bash scripts/ckpt.sh diff 2"
  local ref
  ref="$(resolve_ref "$want")" || die "Stage '${want}' nahi mila."
  echo
  printf "${C_HEAD}=== Stage %s se ab tak kya badla ===${C_OFF}\n" "$want"
  git diff --stat "$ref" -- . | sed 's/^/  /'
  echo
}

cmd_status() {
  echo
  printf "${C_HEAD}=== BRANCH ===${C_OFF}\n"; git rev-parse --abbrev-ref HEAD | sed 's/^/  /'
  printf "${C_HEAD}=== ABHI KA STAGE ===${C_OFF}\n  Stage %s\n" "$(current_stage_number)"
  printf "${C_HEAD}=== SAVE NA SHUDA KAAM ===${C_OFF}\n"
  if is_dirty; then
    git status --short | sed 's/^/  /'
    printf "  ${C_WARN}-> save karne ke liye:  bash scripts/ckpt.sh save \"...\"${C_OFF}\n"
  else
    printf "  (sab kuch save ho chuka hai)\n"
  fi
  printf "${C_HEAD}=== GITHUB SE RISHTA ===${C_OFF}\n"; git status -sb | head -1 | sed 's/^/  /'
  echo
}

cmd_push() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  log "Branch '${branch}' aur saare checkpoints GitHub par bheje ja rahe hain..."
  git push -q origin "$branch" 2>&1 | sed 's/^/  /'
  git push -q origin --tags 2>&1 | sed 's/^/  /'
  ok "GitHub par mehfooz. Nayi session mein bhi sab wapas mil jayega."
}

cmd_help() {
  cat <<'EOF'

  Area11 - Checkpoint system  (wapas jane ka system)

    bash scripts/ckpt.sh save "kaam ka naam"   stage save karo (auto number)
    bash scripts/ckpt.sh list                  saare stages dekho
    bash scripts/ckpt.sh go 3                  stage 3 par jao
    bash scripts/ckpt.sh undo                  pichle stage par jao
    bash scripts/ckpt.sh diff 2                stage 2 se ab tak kya badla
    bash scripts/ckpt.sh status                abhi ka haal
    bash scripts/ckpt.sh push                  GitHub par mehfooz karo

  YAAD RAHE: 'go' ya 'undo' se pehle system KHUD safety snapshot bana leta
  hai. Is liye aap ka adhoora kaam bhi kabhi zaya nahi hota.

EOF
}

case "${1:-help}" in
  save)             shift; cmd_save "$@" ;;
  list|ls)          cmd_list ;;
  go|restore)       shift; cmd_go "$@" ;;
  undo|back)        cmd_undo ;;
  diff)             shift; cmd_diff "$@" ;;
  status|st)        cmd_status ;;
  push)             cmd_push ;;
  help|-h|--help|"") cmd_help ;;
  *) die "Na maloom command: '$1'   (madad:  bash scripts/ckpt.sh help)" ;;
esac
