import assert from 'node:assert/strict';
import { test } from 'node:test';
import { smootherstep, Spring } from '../src/motion.ts';

test('smootherstep is clamped, symmetric and monotonic', () => {
  assert.equal(smootherstep(-1), 0);
  assert.equal(smootherstep(0), 0);
  assert.equal(smootherstep(0.5), 0.5);
  assert.equal(smootherstep(1), 1);
  assert.equal(smootherstep(2), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const v = smootherstep(i / 100);
    assert.ok(v >= previous);
    assert.ok(Math.abs(v + smootherstep(1 - i / 100) - 1) < 1e-12);
    previous = v;
  }
});

test('spring settles on its target', () => {
  const s = new Spring(0, 120, 20);
  s.target = 1;
  for (let i = 0; i < 300; i++) s.step(1 / 60);
  assert.ok(s.settled);
  assert.ok(Math.abs(s.value - 1) < 1e-5);
});

test('spring gives the same result at different frame rates', () => {
  const run = (fps: number) => {
    const s = new Spring(0, 42, 9.5);
    s.target = Math.PI;
    for (let i = 0; i < fps; i++) s.step(1 / fps);
    return s.value;
  };
  assert.ok(Math.abs(run(30) - run(144)) < 1e-2);
});
