// Pengujian unit logika antarmuka: aturan hapus tugas dan perhitungan seret jadwal di Timeline.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkDeleteBlocker,
  deleteBlocker,
  orderForStatus,
  prerequisitesFirst,
  scheduleBody,
  shiftSpan,
  spanOf,
} from '../src/lib/taskGuards.js';

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

describe('aksi massal pada rantai prasyarat', () => {
  // C menunggu B, B menunggu A
  const A = { id: 'A', prerequisites: [], dependents: [{ id: 'B', title: 'B' }] };
  const B = { id: 'B', prerequisites: [{ id: 'A' }], dependents: [{ id: 'C', title: 'C' }] };
  const C = { id: 'C', prerequisites: [{ id: 'B' }], dependents: [] };
  const ids = (list) => list.map((t) => t.id).join('');
  test('prasyarat diproses lebih dulu saat memulai/menyelesaikan', () => {
    assert.equal(ids(orderForStatus([C, A, B], 'DONE')), 'ABC');
  });
  test('tugas lanjutan diproses lebih dulu saat dibuka kembali', () => {
    assert.equal(ids(orderForStatus([A, C, B], 'TODO')), 'CBA');
  });
  test('prasyarat di luar pilihan tidak menahan urutan', () => {
    assert.equal(ids(prerequisitesFirst([C])), 'C');
  });
  test('hapus massal boleh bila semua tugas lanjutan ikut dipilih', () => {
    assert.equal(bulkDeleteBlocker([A, B, C]), null);
  });
  test('hapus massal ditolak bila ada tugas lanjutan di luar pilihan', () => {
    assert.match(bulkDeleteBlocker([A]), /prasyarat bagi: B/);
  });
});
