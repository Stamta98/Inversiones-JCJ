-- Cierra la API publica de Supabase sobre estas tablas.
--
-- Supabase expone automaticamente una API REST sobre el esquema `public`. Sin
-- esto, cualquiera con la clave anon (que es publica por diseño) podria leer
-- clientes, cedulas, prestamos y cobros. Se habilita RLS sin ninguna politica:
-- las claves anon y authenticated no ven nada. La aplicacion conecta por
-- Postgres directo con un rol que omite RLS, asi que sigue funcionando igual.
--
-- En un Postgres normal (sin Supabase) los roles anon y authenticated no
-- existen, por eso el REVOKE va condicionado.
DO $$
DECLARE
  nombre_tabla text;
  hay_anon boolean;
  hay_authenticated boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO hay_anon;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    INTO hay_authenticated;

  FOR nombre_tabla IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nombre_tabla);
    EXECUTE format(
      'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', nombre_tabla);

    IF hay_anon THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', nombre_tabla);
    END IF;
    IF hay_authenticated THEN
      EXECUTE format(
        'REVOKE ALL ON public.%I FROM authenticated', nombre_tabla);
    END IF;
  END LOOP;
END
$$;
