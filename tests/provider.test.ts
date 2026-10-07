import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

const files = [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'scripts'))];
const rel = (f: string) => path.relative(root, f);
const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('Groq is the only AI provider', () => {
  it('has no other AI SDK installed', () => {
    const pkg = JSON.parse(read(path.join(root, 'package.json')));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const other = deps.filter((d) => /^(openai|@anthropic-ai\/|@google\/(generative-ai|genai)|cohere-ai|@mistralai\/|replicate|together-ai|ai$|@ai-sdk\/)/.test(d));
    expect(other).toEqual([]);
    expect(deps).toContain('groq-sdk');
  });

  it('has no other provider imports or API hosts in application code', () => {
    const banned = /from ['"](openai|@anthropic-ai\/[^'"]+|@google\/generative-ai|@google\/genai|cohere-ai|@mistralai\/[^'"]+)['"]|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere\./;
    expect(files.filter((f) => banned.test(read(f))).map(rel)).toEqual([]);
  });

  it('constructs the Groq client in exactly one module', () => {
    const importers = files.filter((f) => /from ['"]groq-sdk['"]/.test(read(f))).map(rel).sort();
    expect(importers).toEqual(['src/server/ai/client.ts', 'src/server/ai/errors.ts']);
    expect(files.filter((f) => /new Groq\(/.test(read(f))).map(rel)).toEqual(['src/server/ai/client.ts']);
  });

  it('routes every feature through the shared service', () => {
    const callers = files.filter((f) => /chat\.completions|audio\.transcriptions/.test(read(f))).map(rel);
    expect(callers).toEqual(['src/server/ai/service.ts']);
  });
});

describe('the Groq key stays on the server', () => {
  it('is read only by server-only modules and never exposed as a public variable', () => {
    const readers = files.filter((f) => /GROQ_API_KEY/.test(read(f))).map(rel).sort();
    expect(readers).toEqual(['src/server/ai/client.ts', 'src/server/env.ts']);
    for (const f of readers) expect(read(path.join(root, f))).toMatch(/^import 'server-only';/);
    expect(files.filter((f) => /NEXT_PUBLIC_[A-Z_]*GROQ/.test(read(f)))).toEqual([]);
  });

  it('keeps the YouTube key on the server and only talks to the official API', () => {
    // Files that read or define the variable (the interface may mention its name in setup instructions).
    const readers = files.filter((f) => /env\(\)\.YOUTUBE_API_KEY|process\.env\.YOUTUBE_API_KEY|YOUTUBE_API_KEY: z\./.test(read(f))).map(rel).sort();
    expect(readers).toEqual(['src/server/env.ts', 'src/server/video/youtube.ts']);
    for (const f of readers) expect(read(path.join(root, f))).toMatch(/^import 'server-only';/);
    expect(read(path.join(root, 'src/server/video/youtube.ts'))).toContain("'https://www.googleapis.com/youtube/v3'");
    // No scraping of youtube.com pages or unofficial caption endpoints anywhere in the app.
    expect(files.filter((f) => /timedtext|youtubei\/v1|get_video_info/.test(read(f))).map(rel)).toEqual([]);
  });

  it('keeps the Apify token on the server and pins its address', () => {
    const readers = files.filter((f) => /env\(\)\.APIFY_TOKEN|process\.env\.APIFY_TOKEN|APIFY_TOKEN: z\./.test(read(f))).map(rel).sort();
    expect(readers).toEqual(['src/server/env.ts', 'src/server/video/apify.ts']);
    expect(read(path.join(root, 'src/server/video/apify.ts'))).toContain("'https://api.apify.com'");
  });

  it('has no client component importing server code', () => {
    const client = files.filter((f) => /^['"]use client['"]/.test(read(f)));
    expect(client.filter((f) => /from ['"]@\/server\//.test(read(f))).map(rel)).toEqual([]);
  });
});
