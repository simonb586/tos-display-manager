import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const official = 'c:\\users\\sim-0\\onedrive\\documents\\github\\tos-display-manager\\tos-display-manager-stable';
const policy = readFileSync('WORKSPACE_POLICY.md', 'utf8').toLowerCase();
const guard = readFileSync('scripts/verify_official_workspace.mjs', 'utf8').toLowerCase();

assert.ok(policy.includes(official), 'La politique ne désigne pas le chemin stable officiel exact.');
assert.ok(policy.includes('c:\\dev\\tos-display-manager'), 'La politique ne classe pas C:\\dev comme ancienne copie.');
assert.match(policy, /comparaisons|comparaison/, 'La politique doit limiter C:\\dev à la comparaison/récupération.');
assert.ok(guard.includes(official.replaceAll('\\', '\\\\')), 'Le garde ne contient pas le chemin stable officiel exact.');
assert.ok(!guard.includes("['one', 'drive']"), 'Le garde ne doit plus interdire OneDrive en général.');

console.log('Politique workspace : stable officiel exact; parent, C:\\dev et autres copies interdits hors CI/Vercel.');
