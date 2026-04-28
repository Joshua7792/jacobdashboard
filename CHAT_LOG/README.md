# Chat Log

This folder holds detailed per-session recaps so context survives even when
chat history is lost.

## What goes here

- `YYYY-MM-DD_topic.md` — Claude's structured narrative recap of one work
  session, organized chronologically. Easy to read; not verbatim.
- `YYYY-MM-DD_topic.raw.jsonl` — the **actual verbatim transcript** copied
  from Claude Code's local storage (one JSON object per line, full
  user/assistant turns + tool calls + tool results).

The two files for one session share the same date prefix so they pair up.

## Where the raw transcripts live (for future sessions)

Claude Code stores every conversation locally on your machine as JSONL
files at:

```text
C:\Users\jsant\.claude\projects\c--Users-jsant-jacobdashboard\
```

Inside that folder, each `.jsonl` file is one session, named with a UUID
like `3c417e59-c8d6-4b03-812a-26e5c58a4489.jsonl`. To find the session you
care about, sort by **last modified time** — the most recently edited
file is your active conversation.

After a session you want to preserve, just copy that `.jsonl` into this
`CHAT_LOG/` folder, renaming it `YYYY-MM-DD_<topic>.raw.jsonl` to match
the recap markdown.

You can also ask Claude to do the copy for you:

```text
Copy the raw JSONL of this session into CHAT_LOG/ as
YYYY-MM-DD_<topic>.raw.jsonl
```

Claude knows where to look.

## How to capture a true verbatim transcript

If you need an exact word-for-word copy:

- **Claude Code (CLI/IDE):** the conversation is stored locally under
  `~/.claude/projects/...`. Use the IDE's chat-export feature or copy the
  raw JSONL files from there.
- **Claude.ai web:** click your conversation → the three-dot menu → Export.
- **ChatGPT web:** Settings → Data Controls → Export data.

Save those exports outside the repo (or in a separate gitignored folder)
because they often contain large attachments and personal context that
shouldn't be committed.

## How to add a new recap

When a session ends, ask Claude to write a recap into this folder:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md, then write a session recap into
CHAT_LOG/YYYY-MM-DD_<topic>.md covering: what we discussed, what was
decided, what files changed, what tests ran, what's still open.
```

Claude will produce a structured summary you can review and commit.
