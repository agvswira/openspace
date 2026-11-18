// Pengujian unit bentuk data tugas yang dikirim API ke keempat tampilan (Board/List/Calendar/Timeline).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { publicUser, serializeTask } from '../src/lib/serialize.js';

const user = {
  id: 'u1',
  name: 'Nata',
  email: 'nata@openspace.example',
  title: 'FE',
  avatarColor: '#EA580C',
  avatarUrl: null,
  passwordHash: 'rahasia',
};

function rawTask(over = {}) {
  return {
    id: 't1',
    projectId: 'p1',
    project: { id: 'p1', name: 'Proyek' },
    number: 7,
    title: 'Desain poster',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: null,
    dueDate: new Date(2000, 0, 1),
    position: 0,
    completedAt: null,
    milestone: null,
    assignees: [{ user }],
    prerequisites: [{ prerequisite: { id: 't0', title: 'Brief', status: 'TODO' } }],
    dependents: [],
    actionItem: null,
    _count: { comments: 2, links: 1 },
    ...over,
  };
}

describe('publicUser', () => {
  test('tidak pernah membocorkan passwordHash', () => {
    assert.equal('passwordHash' in publicUser(user), false);
  });
  test('null aman', () => {
    assert.equal(publicUser(null), null);
  });
});

describe('serializeTask', () => {
  test('kode tugas diformat OS-###', () => {
    assert.equal(serializeTask(rawTask()).code, 'OS-007');
  });
  test('penanda turunan dihitung: terlambat dan terhambat', () => {
    const t = serializeTask(rawTask());
    assert.equal(t.isOverdue, true);
    assert.equal(t.isBlocked, true);
    assert.deepEqual(t.waitingFor, [{ id: 't0', title: 'Brief', status: 'TODO' }]);
  });
  test('assignee diratakan menjadi daftar user', () => {
    assert.deepEqual(
      serializeTask(rawTask()).assignees.map((u) => u.id),
      ['u1'],
    );
  });
  test('jumlah komentar dan link dibaca dari _count', () => {
    const t = serializeTask(rawTask());
    assert.equal(t.commentCount, 2);
    assert.equal(t.linkCount, 1);
  });
  test('tugas dari rapat menyertakan asal rapat', () => {
    const t = serializeTask(rawTask({ actionItem: { id: 'ai1', meeting: { id: 'm1', title: 'Rapat', date: null } } }));
    assert.deepEqual(t.fromMeeting, { id: 'm1', title: 'Rapat', date: null, actionItemId: 'ai1' });
  });
});
