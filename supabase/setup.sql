-- Hamid Read – Datenbank in Supabase einrichten.
-- Einmal komplett im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
-- Jede Tabelle hat dieselbe Form: id, owner, data (der ganze Datensatz als JSON),
-- updated_at (Zeit der Änderung auf dem Gerät), deleted (weiches Löschen),
-- server_ts (wann der Server die Zeile zuletzt bekam – danach holt der Sync Neues ab).

create or replace function public.hr_neuester_gewinnt() returns trigger
language plpgsql as $$
begin
  -- Konfliktregel: neuester updatedAt gewinnt. Ältere Änderungen werden still verworfen.
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  new.server_ts := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['werke','kuenstler','abc','proben','lernstand','bilder',
                           'buecher','markierungen','buchkarten','dateien','knoten','kanten'] loop
    execute format($f$
      create table if not exists public.%1$I (
        owner      uuid   not null default auth.uid() references auth.users(id) on delete cascade,
        id         text   not null,
        data       jsonb  not null,
        updated_at bigint not null,
        deleted    boolean not null default false,
        server_ts  timestamptz not null default clock_timestamp(),
        primary key (owner, id)
      );
      create index if not exists %1$s_server_ts on public.%1$I (owner, server_ts);
      alter table public.%1$I enable row level security;
      drop policy if exists "nur Besitzer" on public.%1$I;
      create policy "nur Besitzer" on public.%1$I for all to authenticated
        using (owner = auth.uid()) with check (owner = auth.uid());
      drop trigger if exists neuester_gewinnt on public.%1$I;
      create trigger neuester_gewinnt before insert or update on public.%1$I
        for each row execute function public.hr_neuester_gewinnt();
    $f$, t);
    -- Live-Benachrichtigung bei Änderungen (damit das andere Gerät sofort nachlädt)
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Speicher für Bilder und Buchdateien (privat). Pfad: <user-id>/<datei>
insert into storage.buckets (id, name, public) values ('bilder', 'bilder', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('buecher', 'buecher', false) on conflict (id) do nothing;

drop policy if exists "hr eigene Dateien" on storage.objects;
create policy "hr eigene Dateien" on storage.objects for all to authenticated
  using (bucket_id in ('bilder','buecher') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('bilder','buecher') and (storage.foldername(name))[1] = auth.uid()::text);

-- Speicherbelegung für die Anzeige in den Einstellungen
create or replace function public.hr_speicher() returns bigint
language sql security definer set search_path = '' as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
  from storage.objects where (storage.foldername(name))[1] = auth.uid()::text;
$$;
