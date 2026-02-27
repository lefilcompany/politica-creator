
-- Simplificar can_access_resource para usar apenas user_id (sem team)
CREATE OR REPLACE FUNCTION public.can_access_resource(resource_user_id uuid, resource_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT resource_user_id = auth.uid()
$function$;
