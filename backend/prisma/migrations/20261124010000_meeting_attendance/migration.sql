-- Kehadiran peserta rapat (menggantikan action item di halaman Meetings)
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');
ALTER TABLE "MeetingParticipant" ADD COLUMN "attendance" "AttendanceStatus";
