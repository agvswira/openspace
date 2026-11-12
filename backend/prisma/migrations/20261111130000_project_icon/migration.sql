-- Ikon penanda proyek (Figma: tiap proyek punya ikon sendiri)
ALTER TABLE "Project" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'asterisk';
