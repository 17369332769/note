# Project Knowledge Base

This project can use the Obsidian skills installed under `.codex/skills/` when the user asks to save, summarize, organize, or retrieve notes.

## Obsidian Note Rules

- Prefer Markdown notes with clear headings, short paragraphs, and Obsidian wikilinks when linking related notes.
- Use frontmatter for stable metadata when creating knowledge-base notes:
  - `type`: one of `worklog`, `project`, `troubleshooting`, `ai-learning`, `reference`
  - `date`: `YYYY-MM-DD` when the note is date-bound
  - `tags`: concise lowercase tags
- Search existing notes before creating a new note, and update the existing note when it is the same topic.
- Keep raw pasted material separate from polished summaries when possible.

## Suggested Note Locations

- Daily work summaries: `docs/worklog/YYYY-MM-DD.md`
- Project context and decisions: `docs/projects/<project-name>.md`
- Debugging and fixes: `docs/troubleshooting/<topic>.md`
- AI usage and learning notes: `docs/ai-learning/<topic>.md`
- General references: `docs/reference/<topic>.md`

## Expected Workflow

When the user says things like "保存到 Obsidian", "整理进知识库", "生成日报", "记录这次排障", or "沉淀一下":

1. Identify the note type and likely destination.
2. Read relevant existing notes.
3. Write or update the Markdown note.
4. Add related links and a brief follow-up section when useful.
5. Tell the user exactly which note was updated.

