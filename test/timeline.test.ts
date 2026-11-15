import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOP, loopFold, loopTimeFor, loopTurn, SWING, swing } from '../src/timeline.ts';

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('swing runs from start to end over SWING seconds', () => {
  assert.ok(close(swing(Math.PI, 0, 0), Math.PI));
  assert.ok(close(swing(Math.PI, 0, SWING / 2), Math.PI / 2));
  assert.ok(close(swing(Math.PI, 0, SWING), 0));
  assert.ok(close(swing(Math.PI, 0, SWING * 3), 0));
});

test('loop: closed, opens, holds open, closes', () => {
  assert.equal(loopFold(0), Math.PI);
  assert.ok(close(loopFold(LOOP.closed + SWING / 2), Math.PI / 2));
  assert.ok(close(loopFold(LOOP.openedAt), 0));
  assert.ok(close(loopFold(LOOP.openedAt + LOOP.open - 0.01), 0));
  assert.ok(close(loopFold(LOOP.length - 1e-9), Math.PI));
});

test('loop is continuous, including across the wrap', () => {
  const step = 1 / 240;
  for (let t = 0; t < LOOP.length * 2; t += step) {
    assert.ok(Math.abs(loopFold(t + step) - loopFold(t)) < 0.05, `jump at t = ${t}`);
  }
});

test('loop stays within the hinge range', () => {
  for (let t = -LOOP.length; t < LOOP.length * 2; t += 0.01) {
    const f = loopFold(t);
    assert.ok(f >= 0 && f <= Math.PI);
  }
});

test('resuming playback continues from the hinge side', () => {
  assert.ok(close(loopFold(loopTimeFor(0)), 0));
  assert.equal(loopFold(loopTimeFor(Math.PI)), Math.PI);
});

test('the turn happens only while fully open, and ends a whole turn round', () => {
  for (let t = 0; t < LOOP.length; t += 0.01) {
    const turning = loopTurn(t) > 0 && loopTurn(t) < 2 * Math.PI;
    if (turning) assert.ok(close(loopFold(t), 0), `turning while folding at t = ${t}`);
  }
  assert.equal(loopTurn(0), 0);
  assert.ok(close(loopTurn(LOOP.openedAt + LOOP.turnAt + LOOP.turnFor), 2 * Math.PI));
  assert.ok(LOOP.turnAt + LOOP.turnFor <= LOOP.open);
});
