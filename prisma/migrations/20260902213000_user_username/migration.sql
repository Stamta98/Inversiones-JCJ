-- Sign-in name, an alternative to the email.
--
-- The column ends up NOT NULL and unique, so it is added empty, filled in for
-- the accounts that already exist, and only then locked down.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- The local part of the email is the name people already recognise. Anything
-- that is not a letter, a digit, a dot, an underscore or a hyphen becomes a
-- dot, repeats collapse, and leading or trailing separators go away.
WITH cleaned AS (
  SELECT
    "id",
    NULLIF(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]+', '.', 'g'),
          '[._-]{2,}', '.', 'g'
        ),
        '^[._-]+|[._-]+$', '', 'g'
      ),
      ''
    ) AS base
  FROM "User"
),
padded AS (
  SELECT
    "id",
    -- Below the three character minimum, and for an email whose local part was
    -- nothing but punctuation, fall back to something valid.
    CASE
      WHEN length(COALESCE(base, 'usuario')) < 3
        THEN rpad(COALESCE(base, 'usuario'), 3, '0')
      ELSE left(COALESCE(base, 'usuario'), 30)
    END AS base
  FROM cleaned
),
numbered AS (
  SELECT
    "id",
    base,
    row_number() OVER (PARTITION BY base ORDER BY "id") AS position
  FROM padded
)
UPDATE "User" AS u
SET "username" = CASE
  WHEN n.position = 1 THEN n.base
  -- Two people can share a local part across different domains; the second
  -- one gets a suffix rather than a failed migration.
  ELSE rtrim(left(n.base, 30 - length(n.position::text)), '._-') || n.position::text
END
FROM numbered AS n
WHERE u."id" = n."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
