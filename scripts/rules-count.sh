#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Area11 - Rules Counter  ("koi baat miss na ho")
# ---------------------------------------------------------------------------
# Kaam: PHASE-TWO-INFORMATION.md padh kar har qism ke numbered points ginta hai
#       aur batata hai ke koi number toota (missing/duplicate) to nahi.
#
# RUN: bash scripts/rules-count.sh
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="${1:-$ROOT/PHASE-TWO-INFORMATION.md}"
FILE2="$ROOT/INPUT-INFORMATION.md"

[ -f "$FILE" ] || { echo "[error] File nahi mili: $FILE" >&2; exit 1; }

C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_HEAD=$'\033[36m'; C_OFF=$'\033[0m'

declare -A NAMES=(
  [U]="Aap ke ahkaam (User Rules)"
  [R]="Code dobara istemal (Reuse)"
  [E]="Edit-ability (har cheez badalne ke qabil)"
  [S]="Frontend -> Backend auto sync"
  [P]="Live Preview"
  [B]="Wapas jana (Checkpoint)"
  [Z]="Zero Error"
  [T]="Technology"
  [M]="Milestone plan"
  [Q]="Khule faisle (sawal)"
)

echo
printf "${C_HEAD}=== AREA11 - NUMBERED POINTS KI GINTI ===${C_OFF}\n"
printf "file: %s\n\n" "$(basename "$FILE")"

TOTAL=0
PROBLEM=0
ORDER=(U R E S P B Z T M Q)

for key in "${ORDER[@]}"; do
  # file se is prefix wale numbers nikaalo
  nums="$(grep -oE "\*\*${key}-[0-9]+\*\*" "$FILE" | grep -oE '[0-9]+' | sed 's/^0*//' | sort -n)"
  if [ -z "$nums" ]; then
    printf "  %-2s  %-45s  %s\n" "$key" "${NAMES[$key]}" "0"
    continue
  fi

  count="$(echo "$nums" | wc -l | tr -d ' ')"
  maxv="$(echo "$nums" | tail -1)"
  uniqc="$(echo "$nums" | sort -u | wc -l | tr -d ' ')"
  TOTAL=$((TOTAL + count))

  # missing numbers ki janch (1 se maxv tak sab maujood hon)
  missing=""
  i=1
  while [ "$i" -le "$maxv" ]; do
    echo "$nums" | grep -qx "$i" || missing="$missing $i"
    i=$((i + 1))
  done

  if [ -n "$missing" ]; then
    PROBLEM=1
    printf "  ${C_ERR}%-2s  %-45s  %s  [MISSING:%s]${C_OFF}\n" "$key" "${NAMES[$key]}" "$count" "$missing"
  elif [ "$count" -ne "$uniqc" ]; then
    PROBLEM=1
    printf "  ${C_ERR}%-2s  %-45s  %s  [DUPLICATE]${C_OFF}\n" "$key" "${NAMES[$key]}" "$count"
  else
    printf "  ${C_OK}%-2s${C_OFF}  %-45s  %s\n" "$key" "${NAMES[$key]}" "$count"
  fi
done

echo
printf "  ${C_HEAD}TOTAL NUMBERED POINTS (PHASE-TWO): %s${C_OFF}\n" "$TOTAL"

# V section mein likhi hui ginti se milaan
if grep -q "کل نمبر دار نکات" "$FILE"; then
  CLAIMED="$(grep -A1 "کل نمبر دار نکات" "$FILE" | grep -oE '\*\*[0-9]+\*\*' | grep -oE '[0-9]+' | head -1)"
  if [ -n "${CLAIMED:-}" ]; then
    if [ "$CLAIMED" = "$TOTAL" ]; then
      printf "  ${C_OK}[ok]${C_OFF} V-section mein likhi ginti (%s) bilkul theek hai.\n" "$CLAIMED"
    else
      printf "  ${C_ERR}[warn]${C_OFF} V-section mein %s likha hai magar asal ginti %s hai - update karein.\n" "$CLAIMED" "$TOTAL"
      PROBLEM=1
    fi
  fi
fi

# --- doosri file: INPUT-INFORMATION (A aur Q) -------------------------------
if [ -f "$FILE2" ] && [ "$FILE" != "$FILE2" ]; then
  printf "\n"
  printf "${C_HEAD}=== INPUT-INFORMATION KE NUMBERED POINTS ===${C_OFF}\n"
  printf "file: %s\n\n" "$(basename "$FILE2")"

  for pair in "A:Spec se tay shuda (Approved)" "Q:Khule faisle (sawal)"; do
    key="${pair%%:*}"; label="${pair#*:}"
    nums="$(grep -oE "\*\*${key}-[0-9]+\*\*" "$FILE2" | grep -oE '[0-9]+' | sed 's/^0*//' | sort -n)"
    if [ -z "$nums" ]; then printf "  %-2s  %-45s  %s\n" "$key" "$label" "0"; continue; fi
    count="$(echo "$nums" | wc -l | tr -d ' ')"
    maxv="$(echo "$nums" | tail -1)"
    uniqc="$(echo "$nums" | sort -u | wc -l | tr -d ' ')"
    missing=""; i=1
    while [ "$i" -le "$maxv" ]; do
      echo "$nums" | grep -qx "$i" || missing="$missing $i"
      i=$((i + 1))
    done
    if [ -n "$missing" ]; then
      PROBLEM=1
      printf "  ${C_ERR}%-2s  %-45s  %s  [MISSING:%s]${C_OFF}\n" "$key" "$label" "$count" "$missing"
    elif [ "$count" -ne "$uniqc" ]; then
      PROBLEM=1
      printf "  ${C_ERR}%-2s  %-45s  %s  [DUPLICATE]${C_OFF}\n" "$key" "$label" "$count"
    else
      printf "  ${C_OK}%-2s${C_OFF}  %-45s  %s\n" "$key" "$label" "$count"
    fi
  done
fi

echo
if [ "$PROBLEM" -eq 0 ]; then
  printf "  ${C_OK}>>> SAB THEEK: koi number missing ya duplicate nahi.${C_OFF}\n\n"
else
  printf "  ${C_ERR}>>> DIQQAT: upar dekh kar number theek karein.${C_OFF}\n\n"
  exit 1
fi
