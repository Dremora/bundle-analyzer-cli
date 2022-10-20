# Bundle dependency analyzer

Displays size of all external dependencies that are included in the bundle, and
reports duplicates.

## Usage

First, ensure you've built your project with Webpack's [Bundle analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer) or [Next Bundle analyzer](https://www.npmjs.com/package/@next/bundle-analyzer). Assuming you're using npm/yarn and Next.js project, run:

```
npx https://github.com/Dremora/bundle-dependency-analyzer
```

If your project is using pnpm, run:

```
PNPM=true pnpm dlx https://github.com/Dremora/bundle-dependency-analyzer
```

If the location of your Next.js bundle is not under `.next`, or you're using Webpack directly, you can customize the path of the `client.html` file produced by the bundle analyzer:

```
ANALYZE_HTML=dist/.next/analyze/client.html npx https://github.com/Dremora/bundle-dependency-analyzer
```
