// Pengujian unit aturan tugas (Tabel 2.6 laporan): terlambat, terhambat, progres, dan siklus prasyarat.
// Jalankan: npm test (dari folder backend atau root).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findCyclePath, isBlocked, isOverdue, progressOf, startOfToday, waitingFor } from '../src/lib/taskRules.js';

const NOW = new Date(2026, 10, 18, 15, 30); // 18 Nov 2026 pukul 15.30

describe('isOverdue', () => {
  test('belum Done dan deadline sudah lewat → terlambat', () => {
    assert.equal(isOverdue({ status: 'TODO', dueDate: new Date(2026, 10, 17) }, NOW), true);
  });
  test('deadline hari ini belum dianggap terlambat (batas = awal hari ini)', () => {
    assert.equal(isOverdue({ status: 'IN_PROGRESS', dueDate: new Date(2026, 10, 18) }, NOW), false);
  });
  test('tugas Done tidak pernah terlambat', () => {
    assert.equal(isOverdue({ status: 'DONE', dueDate: new Date(2026, 0, 1) }, NOW), false);
  });
  test('tanpa deadline tidak terlambat', () => {
    assert.equal(isOverdue({ status: 'TODO', dueDate: null }, NOW), false);
  });
});

describe('startOfToday', () => {
  test('mengembalikan pukul 00.00 pada hari yang sama', () => {
    const d = startOfToday(NOW);
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 10, 18, 0, 0]);
  });
});

describe('waitingFor / isBlocked', () => {
  const task = {
    prerequisites: [
      { prerequisite: { id: 'a', title: 'Brief', status: 'DONE' } },
      { prerequisite: { id: 'b', title: 'Konsep', status: 'IN_PROGRESS' } },
    ],
  };
  test('hanya prasyarat yang belum Done yang ditunggu', () => {
    assert.deepEqual(
      waitingFor(task).map((p) => p.id),
      ['b'],
    );
  });
  test('ada prasyarat belum Done → terhambat', () => {
    assert.equal(isBlocked(task), true);
  });
  test('semua prasyarat Done → tidak terhambat', () => {
    assert.equal(isBlocked({ prerequisites: [{ prerequisite: { id: 'a', status: 'DONE' } }] }), false);
  });
  test('tanpa prasyarat → tidak terhambat', () => {
    assert.equal(isBlocked({}), false);
  });
});

describe('progressOf', () => {
  test('progres = jumlah Done / seluruh tugas, dibulatkan', () => {
    const tasks = [{ status: 'DONE' }, { status: 'DONE' }, { status: 'TODO' }];
    assert.deepEqual(progressOf(tasks), { total: 3, done: 2, percent: 67 });
  });
  test('proyek tanpa tugas tidak punya persentase', () => {
    assert.deepEqual(progressOf([]), { total: 0, done: 0, percent: null });
  });
});

describe('findCyclePath (DFS pada graf prasyarat)', () => {
  // sisi taskId -> prerequisiteId : "taskId menunggu prerequisiteId"
  const edges = [
    { taskId: 'B', prerequisiteId: 'A' }, // B menunggu A
    { taskId: 'C', prerequisiteId: 'B' }, // C menunggu B
  ];
  test('menambah sisi yang aman → tidak ada siklus', () => {
    assert.equal(findCyclePath(edges, 'D', 'C'), null);
  });
  test('A menunggu C membentuk siklus A → C → B → A', () => {
    assert.deepEqual(findCyclePath(edges, 'A', 'C'), ['A', 'C', 'B', 'A']);
  });
  test('siklus langsung dua tugas terdeteksi', () => {
    assert.deepEqual(findCyclePath([{ taskId: 'B', prerequisiteId: 'A' }], 'A', 'B'), ['A', 'B', 'A']);
  });
  test('graf bercabang tanpa siklus tetap lolos', () => {
    const diamond = [
      { taskId: 'B', prerequisiteId: 'A' },
      { taskId: 'C', prerequisiteId: 'A' },
      { taskId: 'D', prerequisiteId: 'B' },
    ];
    assert.equal(findCyclePath(diamond, 'D', 'C'), null);
  });
});
