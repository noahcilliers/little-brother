---
description: Share this Claude Code session with a Little Brother session (code from the dashboard)
argument-hint: <session-code>
---
lb:join $ARGUMENTS

The Little Brother hook has just tried to connect this Claude Code session to the session with code `$ARGUMENTS`; its result is in the `[little-brother]` context above. Report that result to the user in one short line and do nothing else. If no code was given, tell them to copy it from their session page on the dashboard.
