# Repository Rules

- Always read and follow [agent-docs/STYLE_GUIDE.md](agent-docs/STYLE_GUIDE.md) before writing or modifying code.
- Never adapt production code to tests. Adapt tests to the intended production behavior, not production behavior to test implementation details.
- Use Markdown-first only for novel features needing brainstorming: develop the idea in the feature's `AGENTS.md` before implementation. Routine changes do not require documentation edits.
- Use `AGENTS.md` only for durable structure, design ideas and rationale, constraints, rules, and style. Keep it concise and begin from the intention or core idea, then derive the architecture and design constraints from those first principles.
- Write documentation in plain, human-readable language. Do not compress ideas into cryptic wording merely to make the text shorter.
- Never explain exact code behavior or implementation details in `AGENTS.md`, because that information can drift from the implementation. Prefer self-explanatory code; put details in code comments only when absolutely necessary.
- Do not repeat information within documentation or across memory files. Keep each fact and rationale once in its most relevant location, and reference that location when needed elsewhere.
- Write facts into `AGENTS.md` and other memory Markdown files only when they are verified with complete confidence. Be critical and do not infer or invent design rationale; if it is unclear why something works a certain way, ask the user until the reasoning is understood before documenting it.
