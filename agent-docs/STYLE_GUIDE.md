# Style Guide

- Never define interfaces solely for tests.
- Never adapt production code to tests. Adapt tests to the intended production behavior, not production behavior to test implementation details.
  Example to avoid: adding `finalizeBar(now = Date.now())` solely so tests can supply a time. Keep `finalizeBar()` and mock `Date.now()` in the tests instead.
- Keep generic shared declarations in `libs/shared/src/lib/interfaces/shared.interfaces.ts` or other reusable shared files. Group feature-specific declarations in `libs/shared/src/lib/interfaces/<use-case>.interfaces.ts`. Keep `libs/shared/src/lib/interfaces.ts` as a re-export-only entry point.
- Never introduce circular dependencies.
- Never move generic, reusable interfaces such as `BarWithIndex` into a feature-specific file or give them a feature-specific prefix merely because they currently have one consumer. Keep them in the shared interfaces file.
- Prefix interfaces exclusive to one feature with that feature's name. For example, use `LiveCalculationState`, not `CalculationState`, for live-only state.
- Group enums first, after imports. Define interfaces before the supporting interfaces they reference in the same file.
- Use `any` when typing interchangeable instances would add unnecessary complexity.
- Use ordinary imports, not `import type` or inline `type` import modifiers.
- Never use specific string values as types. Use `string` and check specific values at runtime.
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
- Do not inline collection transformations such as `filter` or `map` in loop headers. Assign the result to a descriptive variable before the loop.
- Structure code clearly and reasonably from first principles. Do not preserve complexity or technical debt merely because it already exists; retain it only when intentional, and document what is retained and why in the relevant feature's `AGENTS.md`.
