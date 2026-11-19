-- PROPOSAL: ask Lovable to import this transaction as a managed migration.
-- Never run against production without approval and a verified restore point.
BEGIN;
-- Fail closed if hosted policies drifted: permissive policies combine with OR.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('companies','operations','rules')
    AND NOT ((tablename='companies' AND policyname='own companies')
      OR (tablename='operations' AND policyname='company ops')
      OR (tablename='rules' AND policyname='company rules'))
  ) THEN RAISE EXCEPTION 'Unexpected RLS policies: audit hosted policy drift before applying'; END IF;
END $$;
ALTER TABLE public.companies ADD CONSTRAINT companies_owner_fk FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.owns_company(_company uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id=_company AND owner_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public.owns_company(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owns_company(uuid) TO authenticated;
CREATE TABLE public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE UNIQUE INDEX company_one_owner ON public.company_members(company_id) WHERE role = 'owner';
CREATE INDEX company_members_user ON public.company_members(user_id, company_id);
INSERT INTO public.company_members(company_id,user_id,role) SELECT id,owner_id,'owner' FROM public.companies;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_members TO authenticated;

CREATE FUNCTION public.company_role(_company uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.company_members WHERE company_id = _company AND user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.company_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_role(uuid) TO authenticated;
CREATE POLICY member_read ON public.company_members FOR SELECT TO authenticated
  USING (public.company_role(company_id) IS NOT NULL);

CREATE FUNCTION public.seed_company_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.company_members(company_id,user_id,role) VALUES(NEW.id,NEW.owner_id,'owner');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seed_company_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER seed_company_owner AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.seed_company_owner();
CREATE FUNCTION public.protect_tenant_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Immutable identity'; END IF;
  IF TG_TABLE_NAME = 'companies' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Ownership transfer requires a dedicated workflow'; END IF;
  ELSE
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN RAISE EXCEPTION 'Immutable company'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_tenant_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_company BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_identity();
CREATE TRIGGER protect_operations BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_identity();
CREATE TRIGGER protect_rules BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_identity();
DROP POLICY "own companies" ON public.companies;
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.company_role(id) IS NOT NULL);
CREATE POLICY company_create ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY company_update ON public.companies FOR UPDATE TO authenticated USING (public.company_role(id) IN ('owner','admin')) WITH CHECK (public.company_role(id) IN ('owner','admin'));
-- Company deletion is deliberately unavailable until a retention/export workflow exists.
DROP POLICY "company ops" ON public.operations;
CREATE POLICY ops_read ON public.operations FOR SELECT TO authenticated USING (public.company_role(company_id) IS NOT NULL);
CREATE POLICY ops_create ON public.operations FOR INSERT TO authenticated WITH CHECK (public.company_role(company_id) IS NOT NULL);
CREATE POLICY ops_update ON public.operations FOR UPDATE TO authenticated USING (public.company_role(company_id) IS NOT NULL) WITH CHECK (public.company_role(company_id) IS NOT NULL);
CREATE POLICY ops_delete ON public.operations FOR DELETE TO authenticated USING (public.company_role(company_id) IN ('owner','admin'));
DROP POLICY "company rules" ON public.rules;
CREATE POLICY rules_read ON public.rules FOR SELECT TO authenticated USING (public.company_role(company_id) IS NOT NULL);
CREATE POLICY rules_create ON public.rules FOR INSERT TO authenticated WITH CHECK (public.company_role(company_id) IN ('owner','admin'));
CREATE POLICY rules_update ON public.rules FOR UPDATE TO authenticated USING (public.company_role(company_id) IN ('owner','admin')) WITH CHECK (public.company_role(company_id) IN ('owner','admin'));
CREATE POLICY rules_delete ON public.rules FOR DELETE TO authenticated USING (public.company_role(company_id) IN ('owner','admin'));
CREATE INDEX operations_company_created ON public.operations(company_id,created_at DESC);
CREATE INDEX rules_company_created ON public.rules(company_id,created_at);

CREATE TABLE public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('admin','member')),
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_invitations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.create_company_invitation(_company uuid,_email text,_role text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation uuid; caller_role text := public.company_role(_company);
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('owner','admin') OR _role IS NULL OR _role NOT IN ('admin','member') OR (caller_role = 'admin' AND _role <> 'member') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _email IS NULL OR trim(_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  INSERT INTO public.company_invitations(company_id,email,role,created_by)
  VALUES(_company,lower(trim(_email)),_role,auth.uid()) RETURNING id INTO invitation;
  RETURN invitation;
END $$;
CREATE FUNCTION public.accept_company_invitation(_token uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.company_invitations; verified_email text;
BEGIN
  SELECT lower(email) INTO verified_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN RAISE EXCEPTION 'Confirmed account required'; END IF;
  SELECT * INTO invitation FROM public.company_invitations WHERE id=_token FOR UPDATE;
  IF NOT FOUND OR invitation.email <> verified_email OR invitation.expires_at <= now() OR invitation.accepted_at IS NOT NULL OR invitation.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  -- A previously issued admin invite cannot be used after the inviter loses authority.
  IF coalesce((SELECT role FROM public.company_members WHERE company_id=invitation.company_id AND user_id=invitation.created_by),'') NOT IN ('owner','admin')
    OR (invitation.role='admin' AND coalesce((SELECT role FROM public.company_members WHERE company_id=invitation.company_id AND user_id=invitation.created_by),'') <> 'owner') THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  INSERT INTO public.company_members(company_id,user_id,role) VALUES(invitation.company_id,auth.uid(),invitation.role) ON CONFLICT DO NOTHING;
  UPDATE public.company_invitations SET accepted_at=now() WHERE id=_token;
  RETURN invitation.company_id;
END $$;
CREATE FUNCTION public.set_company_member_role(_company uuid,_user uuid,_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.company_role(_company) IS DISTINCT FROM 'owner' OR _role IS NULL OR _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.company_members SET role=_role WHERE company_id=_company AND user_id=_user AND role <> 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found or immutable owner'; END IF;
END $$;
CREATE FUNCTION public.remove_company_member(_company uuid,_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.company_role(_company) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.company_members WHERE company_id=_company AND user_id=_user AND role <> 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found or immutable owner'; END IF;
END $$;
CREATE FUNCTION public.revoke_company_invitation(_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.company_invitations SET revoked_at=now() WHERE id=_token AND public.company_role(company_id) IN ('owner','admin');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.create_company_invitation(uuid,text,text), public.accept_company_invitation(uuid), public.set_company_member_role(uuid,uuid,text), public.remove_company_member(uuid,uuid), public.revoke_company_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_company_invitation(uuid,text,text), public.accept_company_invitation(uuid), public.set_company_member_role(uuid,uuid,text), public.remove_company_member(uuid,uuid), public.revoke_company_invitation(uuid) TO authenticated;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  actor_id uuid, action text NOT NULL, entity text NOT NULL, entity_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_company_time ON public.audit_logs(company_id,occurred_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated USING (public.company_role(company_id) IN ('owner','admin'));
CREATE FUNCTION public.audit_company_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_data jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  INSERT INTO public.audit_logs(company_id,actor_id,action,entity,entity_id)
  VALUES(CASE WHEN TG_TABLE_NAME='companies' THEN (row_data->>'id')::uuid ELSE (row_data->>'company_id')::uuid END,
  auth.uid(),TG_OP,TG_TABLE_NAME,coalesce((row_data->>'user_id')::uuid,(row_data->>'id')::uuid));
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.audit_company_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();
CREATE TRIGGER audit_operations AFTER INSERT OR UPDATE OR DELETE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();
CREATE TRIGGER audit_rules AFTER INSERT OR UPDATE OR DELETE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON public.company_members FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();
-- Invitation tokens are secrets: record company as the entity id, never the token/email.
CREATE FUNCTION public.audit_invitation_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs(company_id,actor_id,action,entity,entity_id) VALUES(NEW.company_id,auth.uid(),TG_OP,'company_invitations',NEW.company_id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.audit_invitation_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_invitations AFTER INSERT OR UPDATE ON public.company_invitations FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();
COMMIT;
