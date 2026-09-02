-- ---------------------------------------------------------------------------
-- Shared editing: any signed-in employee may edit any moment (fields, tags,
-- added photos) to speed up populating the timeline. Deletion of a moment or
-- of existing photos stays with the original poster and admins.
-- ---------------------------------------------------------------------------

drop policy "update own moments or admin" on public.moments;
create policy "update moments (shared editing)" on public.moments
  for update to authenticated using (true) with check (true);

drop policy "write moment_people via own moment" on public.moment_people;
create policy "write moment_people (shared editing)" on public.moment_people
  for all to authenticated using (true) with check (true);

drop policy "update own media or admin" on public.media;
create policy "update media (shared editing)" on public.media
  for update to authenticated using (true) with check (true);
