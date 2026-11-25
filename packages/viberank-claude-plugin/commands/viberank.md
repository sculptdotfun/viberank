---
description: Show your viberank standing for this week
allowed-tools: Bash(node:*), Bash(npx -y viberank-cli@latest status:*)
---

Run `node ~/.viberank/statusline.mjs --format long --no-color` and show the user the line it prints, then the links `https://www.viberank.app/recap/<weekId>/<username>` and `https://www.viberank.app/?me=<username>`, taking `weekId` and `username` from `~/.viberank/standing.json`.

If it prints `vr · run npx viberank-cli`, no standing has been saved on this machine yet: tell the user to run `npx viberank-cli` once in a terminal (it signs them in and submits), and that the plugin keeps it current after that. Do not submit anything yourself.

The line reads: week number and day, rank of N in the class (Ranked, Open or Fleets), movement since last week (▲ up, ▼ down, = same, new), spend this week in API-equivalent dollars, the gap to the person above, and the weekly streak.
