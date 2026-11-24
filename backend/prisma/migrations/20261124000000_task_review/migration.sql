-- Status review: anggota mengirim tugas ke Owner untuk diperiksa sebelum Done
ALTER TYPE "TaskStatus" ADD VALUE 'IN_REVIEW' BEFORE 'DONE';
