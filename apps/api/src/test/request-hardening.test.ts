// Findings from the external review: parser errors must not leak the
// parser's message, and the web build must not publish source maps.
import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import app from '../server';

describe('request hardening', () => {
  test('malformed JSON gets a generic 400, not the parser message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", "password": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('The request body is not valid JSON.');
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected|position|JSON\.parse|SyntaxError/);
  });

  test('an oversized body gets a generic 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(2 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.message).toBe('The request is too large.');
  });

  test('the web build publishes no source maps', () => {
    const config = readFileSync(path.resolve(__dirname, '../../../web/vite.config.ts'), 'utf8');
    expect(config).toMatch(/sourcemap:\s*false/);
  });
});
