#!/bin/sh
# Copy the local engine working tree (/tmp/marti) to the shared project folder, without node_modules/dist.
cd /tmp/marti && find . -path ./node_modules -prune -o -path ./dist -prune -o -path ./.vite -prune -o -type f -print | while read f; do
  d="/mnt/project-files/sosisci-oyun/motor/$f"
  if [ ! -f "$d" ] || ! cmp -s "$f" "$d"; then mkdir -p "$(dirname "$d")" && cat "$f" > "$d"; fi
done
