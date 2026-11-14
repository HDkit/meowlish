-- Readable URL key for exams. Nullable: existing rows are filled by the exam service at start-up
-- (ExamSlugBackfill), new exams get one when they are created.
ALTER TABLE "exams" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "exams_slug_key" ON "exams"("slug");
