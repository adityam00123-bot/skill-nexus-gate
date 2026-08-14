-- 1. Create dedicated sequence for course numbers
CREATE SEQUENCE IF NOT EXISTS public.courses_course_number_seq;

-- 2. Add course_number column with DEFAULT linked to the sequence
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS course_number integer DEFAULT nextval('public.courses_course_number_seq');

-- 3. Backfill all existing courses in order of created_at (oldest = 1, newest = highest)
WITH ranked_courses AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS seq_num
    FROM public.courses
)
UPDATE public.courses c
SET course_number = r.seq_num
FROM ranked_courses r
WHERE c.id = r.id;

-- 4. Advance sequence to MAX(course_number) + 1 so new inserts start from next available number
SELECT setval(
    'public.courses_course_number_seq',
    COALESCE((SELECT MAX(course_number) FROM public.courses), 0) + 1,
    false
);

-- 5. Add unique index on course_number for instant lookup
CREATE UNIQUE INDEX IF NOT EXISTS courses_course_number_idx ON public.courses(course_number);

-- 6. Permissions / Grants (Following AGENTS.md rules)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO service_role;
GRANT SELECT ON public.courses TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.courses_course_number_seq TO authenticated, service_role, anon;
