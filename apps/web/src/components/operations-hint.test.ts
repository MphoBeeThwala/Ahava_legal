import { expect, test } from 'vitest';
import { templateHint } from './OperationsHub';

test('the Documents form points to the matching standard templates', () => {
  expect(templateHint('pleading')).toMatch(/^There are 30 standard templates for pleadings/);
  expect(templateHint('memo')).toMatch(/^There is 1 standard template for memoranda/);
  expect(templateHint('template')).toMatch(/firm’s own wording/);
});
