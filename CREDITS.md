# Credits

Taster is released under the [MIT License](./LICENSE). Every third-party asset and library it ships is distributed under an OSI-approved or FSF-approved open source license. No CDN is contacted at runtime.

## Fonts

- **Inter.** Copyright © The Inter Project Authors, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/). Source: <https://github.com/rsms/inter>. Self-hosted through `@fontsource-variable/inter`.
- **Fraunces.** Copyright © The Fraunces Project Authors, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/). Source: <https://github.com/undercasetype/Fraunces>. Self-hosted through `@fontsource-variable/fraunces`.

## Icons

- **Heroicons.** Copyright © Tailwind Labs, licensed under the [MIT License](https://github.com/tailwindlabs/heroicons/blob/master/LICENSE). Source: <https://heroicons.com/>. Bundled as inline SVG through the `components/Icon.ts` helper. The Taster logo itself is an original mark of this project.

## Backend runtime

- [Fastify](https://fastify.dev/) and its plugins (`@fastify/static`, `@fastify/secure-session`, `@fastify/csrf-protection`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/multipart`, `@fastify/compress`). MIT license.
- [sharp](https://sharp.pixelplumbing.com/). Apache-2.0 license, with prebuilt [libvips](https://www.libvips.org/) binaries under LGPL-3.0-or-later. Image normalization.
- [hash-wasm](https://github.com/Daninet/hash-wasm). MIT license. Argon2id password hashing without native compilation.
- [zxcvbn-ts](https://zxcvbn-ts.github.io/zxcvbn/). MIT license. Password strength estimation.
- [dotenv](https://github.com/motdotla/dotenv). BSD-2-Clause license.

## Frontend runtime

- [Marked](https://marked.js.org/). MIT license. Markdown parsing for reviews.
- [DOMPurify](https://github.com/cure53/DOMPurify). Apache-2.0 / MPL-2.0 dual license. Sanitizes the rendered review HTML.
- [Tailwind CSS](https://tailwindcss.com/). MIT license.

## Build tooling

- [Vite](https://vitejs.dev/). MIT license. The frontend bundler.
- [TypeScript](https://www.typescriptlang.org/). Apache-2.0 license.
- [tsx](https://github.com/privatenumber/tsx). MIT license. Server reload in development.

## Acknowledgements

Thanks to the maintainers of every dependency listed above, and to everyone who reported a bug or suggested an improvement.
