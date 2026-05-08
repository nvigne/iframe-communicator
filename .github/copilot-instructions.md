# Repository instructions

## Current repository state

- This package is a small TypeScript browser library for cross-frame messaging between a parent window and one or more iframes.
- `connection.ts` is the only source file included by `tsconfig.json` for declaration and JavaScript output.
- `index.ts` and `iframe.ts` are demo/example entry points that import `MessagingService` from `connection.js`.
- `out/` contains example HTML files and is ignored by git, along with generated `*.js` and `*.d.ts` files.
- `package.json` publishes `connection.js`, `connection.d.ts`, and `README.md`; the package entry point is `connection.js`.

## Validation

- Use `tsc --noEmit` to type-check the current TypeScript source.
- Use `npm test` to run the Vitest test suite.
- There is no configured lint script or build script in `package.json`.

## Coding guidance

- Keep changes focused on `connection.ts` unless updating demos or package metadata is explicitly required.
- Preserve the browser `postMessage` communication model and the existing three-way handshake states: `SYN`, `SYN+ACK`, `ACK`, and `FIN`.
- Do not allow `"*"` as the target origin; the constructor currently rejects wildcard targets.
- Maintain strict TypeScript compatibility with the existing `tsconfig.json` settings.
- Avoid committing generated JavaScript, declaration files, or files under `out/`.
