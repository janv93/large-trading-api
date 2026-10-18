# Repository Rules

- Write the complete answer to the user as the very last message, after every tool call, including the call that marks the task as complete. The chat only shows text written after the last tool call, so anything written earlier is never seen.
- Always clarify a change with the user before making it, unless it is clear that the user wants it implemented and a double check seems unnecessary.
- Untracked files are always committed and pushed together with the other changes, so there is no need to remind the user to add new files.
- Always read and follow [agent-docs/STYLE_GUIDE.md](agent-docs/STYLE_GUIDE.md) before writing or modifying code.
- Use Markdown-first only for novel features needing brainstorming: develop the idea in the feature's `AGENTS.md` before implementation. Routine changes do not require documentation edits.
- Use `AGENTS.md` only for durable structure, design ideas and rationale, constraints, rules, and style. Keep it concise and begin from the intention or core idea, then derive the architecture and design constraints from those first principles.
- Write documentation in plain, human-readable language. Do not compress ideas into cryptic wording merely to make the text shorter.
- Never explain exact code behavior or implementation details in `AGENTS.md`, because that information can drift from the implementation. Prefer self-explanatory code; put details in code comments only when absolutely necessary.
- Do not repeat information within documentation or across memory files. Keep each fact and rationale once in its most relevant location, and reference that location when needed elsewhere.
- Write facts into `AGENTS.md` and other memory Markdown files only when they are verified with complete confidence. Be critical and do not infer or invent design rationale; if it is unclear why something works a certain way, ask the user until the reasoning is understood before documenting it.
