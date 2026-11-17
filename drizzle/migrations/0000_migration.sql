CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sector text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own companies" ON public.companies FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_company(_company uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company AND owner_id = auth.uid())
$$;

CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  owner_name text,
  expected_impact text,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','andamento','concluida')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company ops" ON public.operations FOR ALL TO authenticated USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));

CREATE OR REPLACE FUNCTION public.ops_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status <> 'concluida') THEN NEW.completed_at = now();
  ELSIF NEW.status <> 'concluida' THEN NEW.completed_at = NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ops_touch BEFORE INSERT OR UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.ops_touch();

CREATE TABLE public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('atrasadas','alta','abertas')),
  operator text NOT NULL CHECK (operator IN ('>','>=','<','<=')),
  threshold integer NOT NULL DEFAULT 0,
  guidance text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules TO authenticated;
GRANT ALL ON public.rules TO service_role;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company rules" ON public.rules FOR ALL TO authenticated USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));