# Style Guide

- Declare interfaces only in `libs/shared/src/lib/interfaces.ts`.
- In TypeScript string literals, always use single quotes (`'`), never double quotes (`"`).
- Separate a multi-line block from any adjacent single-line statement at the same indentation level with an empty line, both before and after the block:

  ```typescript
  const activeBar = getActiveBar();

  if (activeBar) {
    processBar(activeBar);
  }

  return activeBar;
  ```

- Use clear, concise variable names; avoid unclear abbreviations such as `ctor` for `constructor`.
- Structure code clearly and reasonably from first principles. Do not preserve complexity or technical debt merely because it already exists; retain it only when intentional, and document what is retained and why in the relevant feature's `AGENTS.md`.
