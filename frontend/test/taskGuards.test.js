// Pengujian unit logika antarmuka: aturan hapus tugas dan perhitungan seret jadwal di Timeline.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deleteBlocker, scheduleBody, shiftSpan, spanOf } from '../src/lib/taskGuards.js';

const d = (day) => new Date(2026, 10, day);
const days = (span) => [span.s.getDate(), span.e.getDate()];

describe('deleteBlocker', () => {
  test('tugas bebas boleh dihapus', () => {
    assert.equal(deleteBlocker({ dependents: [], fromMeeting: null }), null);
  });
  test('tugas yang menjadi prasyarat ditolak dengan nama tugas lanjutannya', () => {
    const msg = deleteBlocker({ dependents: [{ title: 'BAB 2' }] });
    assert.match(msg, /prasyarat bagi: BAB 2/);
  });
  test('tugas dari action item rapat ditolak', () => {
    assert.match(deleteBlocker({ dependents: [], fromMeeting: { title: 'Rapat awal' } }), /Rapat awal/);
  });
});

describe('spanOf', () => {
  test('tugas hanya punya deadline dianggap satu hari', () => {
    assert.deepEqual(days(spanOf({ dueDate: d(20) })), [20, 20]);
  });
  test('jam diabaikan (awal hari)', () => {
    const sp = spanOf({ startDate: new Date(2026, 10, 10, 13, 45), dueDate: d(12) });
    assert.equal(sp.s.getHours(), 0);
  });
});

describe('shiftSpan', () => {
  const span = { s: d(10), e: d(14) };
  test('move: mulai dan deadline bergeser bersama', () => {
    assert.deepEqual(days(shiftSpan(span, 'move', 3)), [13, 17]);
    assert.deepEqual(days(shiftSpan(span, 'move', -2)), [8, 12]);
  });
  test('start: tanggal mulai tidak boleh melewati deadline', () => {
    assert.deepEqual(days(shiftSpan(span, 'start', 2)), [12, 14]);
    assert.deepEqual(days(shiftSpan(span, 'start', 9)), [14, 14]);
  });
  test('end: deadline tidak boleh sebelum tanggal mulai', () => {
    assert.deepEqual(days(shiftSpan(span, 'end', -1)), [10, 13]);
    assert.deepEqual(days(shiftSpan(span, 'end', -9)), [10, 10]);
  });
  test('mode tidak dikenal tidak mengubah jadwal', () => {
    assert.equal(shiftSpan(span, 'link', 5), span);
  });
});

describe('scheduleBody', () => {
  const next = { s: d(11), e: d(15) };
  test('hanya mengirim field yang dimiliki tugas', () => {
    assert.deepEqual(Object.keys(scheduleBody({ dueDate: d(14) }, 'move', next)), ['dueDate']);
  });
  test('menarik tepi kiri menambahkan tanggal mulai walau sebelumnya kosong', () => {
    assert.deepEqual(Object.keys(scheduleBody({ dueDate: d(14) }, 'start', next)).sort(), ['dueDate', 'startDate']);
  });
});
