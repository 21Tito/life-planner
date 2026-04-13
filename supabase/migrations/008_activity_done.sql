alter table trip_activities
  add column if not exists done boolean not null default false;
