// Logika murni (tanpa React) yang dipakai antarmuka tugas, dipisah agar dapat diuji unit.
import { addDays, diffDays, startOfDay } from './format.js';

// Alasan sebuah tugas tidak boleh dihapus (aturan yang sama dengan backend, dicek lebih awal
// agar pengguna langsung mendapat penjelasan tanpa menunggu respons server).
export function deleteBlocker(task) {
  if (task.dependents?.length)
    return `Tugas ini menjadi prasyarat bagi: ${task.dependents.map((d) => d.title).join(', ')}. Hapus hubungan prasyarat terlebih dahulu.`;
  if (task.fromMeeting)
    return `Tugas ini berasal dari action item rapat "${task.fromMeeting.title}" dan tidak dapat dihapus langsung.`;
  return null;
}

// Rentang tanggal efektif sebuah tugas; tugas yang hanya punya salah satu tanggal dianggap satu hari.
export function spanOf(task) {
  return { s: startOfDay(task.startDate || task.dueDate), e: startOfDay(task.dueDate || task.startDate) };
}

/**
 * Jadwal baru setelah bar timeline diseret n hari.
 *  - 'move'  : mulai dan deadline bergeser bersama
 *  - 'start' : hanya tanggal mulai, tidak boleh melewati deadline
 *  - 'end'   : hanya deadline, tidak boleh sebelum tanggal mulai
 */
export function shiftSpan(span, mode, n) {
  const len = diffDays(span.e, span.s);
  if (mode === 'move') return { s: addDays(span.s, n), e: addDays(span.e, n) };
  if (mode === 'start') return { s: addDays(span.s, Math.min(n, len)), e: span.e };
  if (mode === 'end') return { s: span.s, e: addDays(span.e, Math.max(n, -len)) };
  return span;
}

// Body PATCH untuk perubahan jadwal: hanya field yang memang dimiliki/diubah tugas.
export function scheduleBody(task, mode, next) {
  const body = {};
  if (task.startDate || mode === 'start') body.startDate = next.s.toISOString();
  if (task.dueDate || mode === 'end') body.dueDate = next.e.toISOString();
  return body;
}
