#!/usr/bin/env bash
# Checks that the C# course generator (Assets/Scripts/Core/Course.cs) builds exactly the same
# courses as the web game (lane-rush/app/src/logic.js). Needs node and mono (mcs).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
mcs -out:"$tmp/dump.exe" "$here/CourseDump.cs" "$here/../Assets/Scripts/Core/Course.cs" > /dev/null
mono "$tmp/dump.exe" > "$tmp/cs.txt"
node "$here/course-dump.mjs" "$here/../../../lane-rush/app/src/logic.js" > "$tmp/js.txt"
if diff -q "$tmp/js.txt" "$tmp/cs.txt" > /dev/null; then echo "OK: $(wc -l < "$tmp/js.txt") lines, identical courses"; else diff "$tmp/js.txt" "$tmp/cs.txt" | head -20; exit 1; fi
