import assert from 'node:assert/strict';
import config from '../vite.config.js';

const keys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let cases = 0;
try {
  for (const [url, key, allowed] of [
    ['https://project.example.invalid', 'public-fixture-key', true],
    ['[REDACTED]', 'public-fixture-key', false],
    ['not-a-url', 'public-fixture-key', false],
    ['javascript:alert(1)', 'public-fixture-key', false],
    ['https://project.example.invalid', '[REDACTED]', false],
    ['https://project.example.invalid', '********', false],
    ['', 'public-fixture-key', false],
    ['https://project.example.invalid', '', false]
  ]) {
    process.env.VITE_SUPABASE_URL = url;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = key;
    process.env.VITE_SUPABASE_ANON_KEY = '';
    const run = () => config({ command: 'build', mode: 'production' });
    if (allowed) assert.equal(run().build.outDir, 'dist');
    else assert.throws(run, /Invalid public Supabase build configuration/);
    cases += 1;
  }
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}
console.log(`${cases} public build configuration cases PASS; no credentials printed.`);
