# Contributing

Thanks for your interest in grip-post.

The project roadmap and wave plan are tracked in the [issues tab](https://github.com/CodeTonight-SA/grip-post/issues).

## Setup

```
git clone https://github.com/CodeTonight-SA/grip-post.git
cd grip-post
npm install
npm run build
```

Load the `dist/` folder as an unpacked Chrome extension.

## Before submitting a PR

- `npm run typecheck` must pass with zero errors.
- `npm run lint` must pass with zero warnings.
- `npm test` must pass.
- `npm run build` must produce a clean `dist/`.

## Code style

- TypeScript strict mode. No `any`.
- No marketing words in comments or strings. No emojis in source.
- Functions under 30 lines. Extract helpers on first duplication.

## Licence

By contributing you agree your work is licensed under the MIT License.
