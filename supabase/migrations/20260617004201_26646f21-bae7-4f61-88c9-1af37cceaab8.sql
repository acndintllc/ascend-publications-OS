INSERT INTO public.user_roles (user_id, role)
VALUES ('98b27e49-306b-4f97-8e3d-298593ba75c5', 'ceo')
ON CONFLICT (user_id, role) DO NOTHING;