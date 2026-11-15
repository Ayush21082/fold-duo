import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hinge } from '../src/hinge.ts';

test('hinge never leaves [0, π]', () => {
  const hinge = new Hinge();
  hinge.open();
  for (let i = 0; i < 600; i++) {
    hinge.step(1 / 60);
    assert.ok(hinge.value >= 0 && hinge.value <= Math.PI);
  }
  hinge.close();
  for (let i = 0; i < 600; i++) {
    hinge.step(1 / 60);
    assert.ok(hinge.value >= 0 && hinge.value <= Math.PI);
  }
});

test('hinge opens, closes and toggles', () => {
  const hinge = new Hinge();
  assert.equal(hinge.openness, 0);
  hinge.toggle();
  for (let i = 0; i < 600; i++) hinge.step(1 / 60);
  assert.ok(hinge.openness > 0.999);
  hinge.toggle();
  for (let i = 0; i < 600; i++) hinge.step(1 / 60);
  assert.ok(hinge.openness < 0.001);
});

test('hitting a stop reports the impact once', () => {
  const hinge = new Hinge();
  const impacts: number[] = [];
  hinge.onStop = (impact) => impacts.push(impact);
  hinge.open();
  for (let i = 0; i < 600; i++) hinge.step(1 / 60);
  assert.ok(impacts.length >= 1);
  assert.ok(impacts[0] > 0.6);
});
