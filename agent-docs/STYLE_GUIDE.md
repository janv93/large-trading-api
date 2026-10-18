# Style Guide

- Never define interfaces solely for tests.
- Never adapt production code to tests. Adapt tests to the intended production behavior, not production behavior to test implementation details.
  Example to avoid: adding `finalizeBar(now = Date.now())` solely so tests can supply a time. Keep `finalizeBar()` and mock `Date.now()` in the tests instead.
- Keep generic shared declarations in `libs/shared/src/lib/interfaces/shared.interfaces.ts` or other reusable shared files. Group feature-specific declarations in `libs/shared/src/lib/interfaces/<use-case>.interfaces.ts`.
- Never introduce circular dependencies.
- Never move generic, reusable interfaces such as `BarWithIndex` into a feature-specific file or give them a feature-specific prefix merely because they currently have one consumer. Keep them in the shared interfaces file.
- Prefix interfaces exclusive to one feature with that feature's name. For example, use `LiveCalculationState`, not `CalculationState`, for live-only state.
- Group enums first, after imports. Define interfaces before the supporting interfaces they reference in the same file.
- Use `any` when typing interchangeable instances would add unnecessary complexity.
- Use ordinary imports, not `import type` or inline `type` import modifiers.
- Never use an indexed access type when an equivalent named type or interface already exists. Use the named declaration directly, for example `BarPrices` instead of `Bar['prices']`.
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
- Do not introduce new terminology in names unless it describes a genuinely new concept. Bad example: calling the price at which a trend reverses `protectiveLevel` because it "protects" the current trend until crossed. This adds a metaphor for a reversal price, not a new concept. Use `reversalPrice` instead.
- Name every function that returns a boolean after what it returns, in a form such as `is...` or `has...`, for example `isRightBufferClosed`. Never return a boolean from a function named after an action, such as `settleRightBuffer`; separate the action from the check instead.
- Never store a helper value used in only one place, such as a fixed array to iterate over, as a class field. Write it inline where it is used.
- Never write code comments. Make the code explain itself through structure and names instead.
- Never create a variable solely to shorten syntax. Access the existing value directly; for example, use `this.activeState` rather than introducing `const activeState = this.activeState` only as an alias.
- Do not inline collection transformations such as `filter` or `map` in loop headers. Assign the result to a descriptive variable before the loop.
- Use an early `return` or `continue` only to save nesting for code that follows it. When the guarded code is already the last thing in its function or loop body, write a plain `if` with the positive condition instead.

  ```typescript
  // Avoid
  function update(): void {
    if (!isReady) return;
    start();
  }

  // Prefer
  function update(): void {
    if (isReady) start();
  }
  ```

- Structure code clearly and reasonably from first principles. Do not preserve complexity or technical debt merely because it already exists; retain it only when intentional, and document what is retained and why in the relevant feature's `AGENTS.md`.
