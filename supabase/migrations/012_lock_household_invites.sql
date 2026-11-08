-- Any signed-in user could read every invite (and its token), then accept it and join that
-- household. Invites are now looked up by token on the server only; owners keep access to
-- their own through "Owners manage invites".
drop policy if exists "Authenticated users can read invites" on public.household_invites;
