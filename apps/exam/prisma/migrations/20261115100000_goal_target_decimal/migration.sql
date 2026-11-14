-- Goal targets in each test's own scale, including half bands (IELTS 6.5, VSTEP 7.5).
-- Widening an integer to double precision keeps every existing value.
ALTER TABLE "goals" ALTER COLUMN "target" SET DATA TYPE DOUBLE PRECISION;
