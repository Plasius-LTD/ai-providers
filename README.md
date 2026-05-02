# @plasius/ai-providers

Provider adapter contracts and implementations for the Plasius agentic AI package family.

## Scope

This package is part of the layered `@plasius/ai-*` package family. It is intentionally bootstrapped with a small public contract surface so implementation can evolve behind tracked Feature/Story/Task work.

## Install

```bash
npm install @plasius/ai-providers
```

## Usage

```ts
import { packageDescriptor } from "@plasius/ai-providers";

console.log(packageDescriptor.packageName);
```

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run pack:check
```

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
