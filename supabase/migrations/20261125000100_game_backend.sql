create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid not null references auth.users (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  is_ready boolean not null default false,
  is_eliminated boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, id)
);

create table public.game_sessions (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  phase text not null check (phase in ('clue', 'vote', 'final_guess', 'result')),
  round_number integer not null default 1,
  current_turn_player_id uuid references auth.users (id) on delete set null,
  eliminated_player_id uuid references auth.users (id) on delete set null,
  winner text check (winner in ('civilians', 'imposters')),
  turn_deadline timestamptz,
  started_at timestamptz not null default now()
);

create table public.game_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  word text not null,
  category text not null,
  imposter_ids uuid[] not null,
  turn_order uuid[] not null,
  votes jsonb not null default '{}'::jsonb,
  final_guess_enabled boolean not null
);

create table public.game_clues (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_number integer not null default 1,
  player_id uuid not null references auth.users (id) on delete cascade,
  clue text not null check (char_length(clue) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (room_id, round_number, player_id)
);

create table public.game_word_bank (
  id bigint generated always as identity primary key,
  word text not null,
  category text not null check (category in ('pop-culture', 'world', 'food')),
  difficulty text not null check (difficulty in ('Easy', 'Sneaky', 'Brutal'))
);

create index players_room_id_idx on public.players (room_id);
create index game_clues_room_id_idx on public.game_clues (room_id);

insert into public.game_word_bank (word, category, difficulty) values
  ('Movie theater', 'pop-culture', 'Easy'),
  ('Superhero', 'pop-culture', 'Easy'),
  ('Karaoke', 'pop-culture', 'Easy'),
  ('Popcorn', 'pop-culture', 'Easy'),
  ('Red carpet', 'pop-culture', 'Easy'),
  ('Dance battle', 'pop-culture', 'Easy'),
  ('Music video', 'pop-culture', 'Easy'),
  ('Reality show', 'pop-culture', 'Easy'),
  ('Award show', 'pop-culture', 'Easy'),
  ('Action movie', 'pop-culture', 'Easy'),
  ('Plot twist', 'pop-culture', 'Sneaky'),
  ('Method acting', 'pop-culture', 'Sneaky'),
  ('One-hit wonder', 'pop-culture', 'Sneaky'),
  ('Multiverse', 'pop-culture', 'Sneaky'),
  ('Indie film', 'pop-culture', 'Sneaky'),
  ('Soundtrack', 'pop-culture', 'Sneaky'),
  ('Cult classic', 'pop-culture', 'Brutal'),
  ('Unreliable narrator', 'pop-culture', 'Brutal'),
  ('Fourth wall', 'pop-culture', 'Brutal'),
  ('Cinematography', 'pop-culture', 'Brutal'),
  ('Eiffel Tower', 'world', 'Easy'),
  ('Beach', 'world', 'Easy'),
  ('Airport', 'world', 'Easy'),
  ('Desert', 'world', 'Easy'),
  ('Waterfall', 'world', 'Easy'),
  ('Train station', 'world', 'Easy'),
  ('Amusement park', 'world', 'Easy'),
  ('Island', 'world', 'Easy'),
  ('Museum', 'world', 'Easy'),
  ('Mountain', 'world', 'Easy'),
  ('Northern lights', 'world', 'Sneaky'),
  ('Silk Road', 'world', 'Sneaky'),
  ('Floating market', 'world', 'Sneaky'),
  ('Border crossing', 'world', 'Sneaky'),
  ('Ghost town', 'world', 'Sneaky'),
  ('Underground city', 'world', 'Brutal'),
  ('Equator', 'world', 'Brutal'),
  ('International date line', 'world', 'Brutal'),
  ('Cul-de-sac', 'world', 'Brutal'),
  ('Geothermal spring', 'world', 'Brutal'),
  ('Pizza', 'food', 'Easy'),
  ('Ice cream', 'food', 'Easy'),
  ('Pancakes', 'food', 'Easy'),
  ('Sushi', 'food', 'Easy'),
  ('Lemonade', 'food', 'Easy'),
  ('Birthday cake', 'food', 'Easy'),
  ('French fries', 'food', 'Easy'),
  ('Taco truck', 'food', 'Easy'),
  ('Smoothie', 'food', 'Easy'),
  ('Barbecue', 'food', 'Easy'),
  ('Sourdough starter', 'food', 'Sneaky'),
  ('Secret ingredient', 'food', 'Sneaky'),
  ('Food truck', 'food', 'Sneaky'),
  ('Midnight snack', 'food', 'Sneaky'),
  ('Taste test', 'food', 'Sneaky'),
  ('Fermentation', 'food', 'Brutal'),
  ('Molecular gastronomy', 'food', 'Brutal'),
  ('Umami', 'food', 'Brutal'),
  ('Blind baking', 'food', 'Brutal'),
  ('Deglazing', 'food', 'Brutal');

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_clues enable row level security;
alter table public.game_word_bank enable row level security;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.players
    where room_id = p_room_id
      and id = (select auth.uid())
  );
$$;

revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy "Room members can read their room"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

create policy "Room members can read their players"
  on public.players for select to authenticated
  using (public.is_room_member(room_id));

create policy "Room members can read game sessions"
  on public.game_sessions for select to authenticated
  using (public.is_room_member(room_id));

create policy "Room members can read clues"
  on public.game_clues for select to authenticated
  using (public.is_room_member(room_id));

grant select on public.rooms, public.players, public.game_sessions, public.game_clues to authenticated;
revoke all on public.game_secrets, public.game_word_bank from anon, authenticated;

create or replace function public.create_room(p_display_name text, p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_code text;
  v_name text := left(trim(coalesce(p_display_name, '')), 24);
  v_settings jsonb;
  v_max_players integer;
  v_imposters integer;
  v_category text;
  v_difficulty text;
  v_hint text;
begin
  if v_user_id is null then raise exception 'Sign in as a guest to create a room.'; end if;
  if v_name = '' then raise exception 'Enter a player name.'; end if;
  if jsonb_typeof(p_settings) <> 'object' then raise exception 'Game settings are invalid.'; end if;

  v_max_players := greatest(3, least(20, coalesce((p_settings->>'maxPlayers')::integer, 8)));
  v_imposters := greatest(1, least(3, coalesce((p_settings->>'imposters')::integer, 1)));
  if v_imposters >= v_max_players then raise exception 'There must be at least one civilian.'; end if;

  v_category := case p_settings->>'category'
    when 'pop-culture' then 'pop-culture'
    when 'world' then 'world'
    when 'food' then 'food'
    else 'all'
  end;
  v_difficulty := case p_settings->>'difficulty'
    when 'Sneaky' then 'Sneaky'
    when 'Brutal' then 'Brutal'
    else 'Easy'
  end;
  v_hint := case p_settings->>'imposterHint'
    when 'none' then 'none'
    else 'category'
  end;

  v_settings := jsonb_build_object(
    'maxPlayers', v_max_players,
    'imposters', v_imposters,
    'category', v_category,
    'difficulty', v_difficulty,
    'clueTimer', greatest(30, least(120, coalesce((p_settings->>'clueTimer')::integer, 60))),
    'imposterHint', v_hint,
    'finalGuess', coalesce((p_settings->>'finalGuess')::boolean, true),
    'customRules', left(coalesce(p_settings->>'customRules', ''), 140)
  );

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, host_id, settings)
  values (v_code, v_user_id, v_settings)
  returning id into v_room_id;

  insert into public.players (id, room_id, display_name, is_ready)
  values (v_user_id, v_room_id, v_name, true);

  return jsonb_build_object('room_id', v_room_id, 'code', v_code);
end;
$$;

create or replace function public.join_room(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_name text := left(trim(coalesce(p_display_name, '')), 24);
begin
  if v_user_id is null then raise exception 'Sign in as a guest to join a room.'; end if;
  if v_name = '' then raise exception 'Enter a player name.'; end if;

  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'That game code is invalid.'; end if;

  if exists (select 1 from public.players where room_id = v_room.id and id = v_user_id) then
    update public.players set display_name = v_name where room_id = v_room.id and id = v_user_id;
  else
    if v_room.status <> 'lobby' then raise exception 'That game has already started.'; end if;
    if (select count(*) from public.players where room_id = v_room.id) >= (v_room.settings->>'maxPlayers')::integer then
      raise exception 'This lobby is full.';
    end if;
    insert into public.players (id, room_id, display_name)
    values (v_user_id, v_room.id, v_name);
  end if;

  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end;
$$;

create or replace function public.update_room_settings(p_room_id uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = auth.uid() and status = 'lobby'
  ) then raise exception 'Only the host can edit a lobby.'; end if;

  v_settings := jsonb_build_object(
    'maxPlayers', greatest(3, least(20, coalesce((p_settings->>'maxPlayers')::integer, 8))),
    'imposters', greatest(1, least(3, coalesce((p_settings->>'imposters')::integer, 1))),
    'category', case p_settings->>'category'
      when 'pop-culture' then 'pop-culture' when 'world' then 'world' when 'food' then 'food' else 'all' end,
    'difficulty', case p_settings->>'difficulty'
      when 'Sneaky' then 'Sneaky' when 'Brutal' then 'Brutal' else 'Easy' end,
    'clueTimer', greatest(30, least(120, coalesce((p_settings->>'clueTimer')::integer, 60))),
    'imposterHint', case p_settings->>'imposterHint' when 'none' then 'none' else 'category' end,
    'finalGuess', coalesce((p_settings->>'finalGuess')::boolean, true),
    'customRules', left(coalesce(p_settings->>'customRules', ''), 140)
  );
  if (v_settings->>'imposters')::integer >= (v_settings->>'maxPlayers')::integer then
    raise exception 'There must be at least one civilian.';
  end if;
  if (select count(*) from public.players where room_id = p_room_id) > (v_settings->>'maxPlayers')::integer then
    raise exception 'The player limit cannot be lower than the number of players already in the lobby.';
  end if;

  update public.rooms set settings = v_settings where id = p_room_id;
end;
$$;

create or replace function public.set_player_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.players set is_ready = p_ready
  where room_id = p_room_id and id = auth.uid()
    and exists (select 1 from public.rooms where id = p_room_id and status = 'lobby');
  if not found then raise exception 'You are not in this active lobby.'; end if;
end;
$$;

create or replace function public.start_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_player_count integer;
  v_word text;
  v_word_category text;
  v_imposters uuid[];
  v_order uuid[];
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.host_id <> auth.uid() or v_room.status <> 'lobby' then
    raise exception 'Only the host can start this lobby.';
  end if;

  select count(*) into v_player_count from public.players where room_id = p_room_id;
  if v_player_count < 3 then raise exception 'At least 3 players are needed to start.'; end if;
  if v_player_count > (v_room.settings->>'maxPlayers')::integer then raise exception 'The lobby exceeds its player limit.'; end if;
  if (select count(*) from public.players where room_id = p_room_id and is_ready) <> v_player_count then
    raise exception 'Wait until every player is ready.';
  end if;
  if (v_room.settings->>'imposters')::integer >= v_player_count then
    raise exception 'There must be at least one civilian.';
  end if;

  select word, category into v_word, v_word_category
  from public.game_word_bank
  where (v_room.settings->>'category' = 'all' or category = v_room.settings->>'category')
    and difficulty = v_room.settings->>'difficulty'
  order by random()
  limit 1;
  if v_word is null then
    select word, category into v_word, v_word_category
    from public.game_word_bank
    where (v_room.settings->>'category' = 'all' or category = v_room.settings->>'category')
    order by random()
    limit 1;
  end if;
  if v_word is null then raise exception 'No words are configured for that category.'; end if;

  select array_agg(id order by random()) into v_order from public.players where room_id = p_room_id;
  select array_agg(id) into v_imposters
  from (
    select id from public.players where room_id = p_room_id order by random()
    limit (v_room.settings->>'imposters')::integer
  ) selected;

  insert into public.game_secrets (room_id, word, category, imposter_ids, turn_order, final_guess_enabled)
  values (p_room_id, v_word, v_word_category, v_imposters, v_order, (v_room.settings->>'finalGuess')::boolean);
  insert into public.game_sessions (room_id, phase, current_turn_player_id, turn_deadline)
  values (
    p_room_id,
    'clue',
    v_order[1],
    now() + make_interval(secs => (v_room.settings->>'clueTimer')::integer)
  );
  update public.rooms set status = 'playing' where id = p_room_id;
end;
$$;

create or replace function public.get_my_role(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret public.game_secrets%rowtype;
  v_settings jsonb;
  v_is_imposter boolean;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  select * into v_secret from public.game_secrets where room_id = p_room_id;
  if not found then raise exception 'The game has not started.'; end if;
  select settings into v_settings from public.rooms where id = p_room_id;
  v_is_imposter := auth.uid() = any(v_secret.imposter_ids);

  return jsonb_build_object(
    'is_imposter', v_is_imposter,
    'word', case when v_is_imposter then null else v_secret.word end,
    'category_hint', case
      when v_is_imposter and v_settings->>'imposterHint' = 'category' then v_secret.category
      else null
    end
  );
end;
$$;

create or replace function public.advance_clue_turn(p_room_id uuid, p_player_id uuid, p_clue text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_turn_order uuid[];
  v_position integer;
  v_next_player uuid;
  v_index integer;
  v_timer integer;
begin
  insert into public.game_clues (room_id, round_number, player_id, clue)
  select p_room_id, round_number, p_player_id, p_clue
  from public.game_sessions
  where room_id = p_room_id and phase = 'clue';

  select turn_order into v_turn_order from public.game_secrets where room_id = p_room_id;
  v_position := array_position(v_turn_order, p_player_id);
  if v_position is not null then
    for v_index in (v_position + 1)..array_length(v_turn_order, 1) loop
      if exists (
        select 1 from public.players
        where room_id = p_room_id and id = v_turn_order[v_index] and not is_eliminated
      ) then
        v_next_player := v_turn_order[v_index];
        exit;
      end if;
    end loop;
  end if;
  if v_next_player is null then
    update public.game_sessions
    set phase = 'vote', current_turn_player_id = null, turn_deadline = null
    where room_id = p_room_id;
  else
    select (settings->>'clueTimer')::integer into v_timer from public.rooms where id = p_room_id;
    update public.game_sessions
    set current_turn_player_id = v_next_player, turn_deadline = now() + make_interval(secs => v_timer)
    where room_id = p_room_id;
  end if;
end;
$$;

create or replace function public.submit_clue(p_room_id uuid, p_clue text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.game_sessions%rowtype;
begin
  if char_length(trim(coalesce(p_clue, ''))) not between 1 and 80 then
    raise exception 'A clue must be between 1 and 80 characters.';
  end if;
  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found or v_game.phase <> 'clue' or v_game.current_turn_player_id <> auth.uid() then
    raise exception 'It is not your turn to give a clue.';
  end if;
  if v_game.turn_deadline <= now() then raise exception 'Your clue turn has expired.'; end if;
  if exists (
    select 1 from public.game_clues
    where room_id = p_room_id and round_number = v_game.round_number and player_id = auth.uid()
  ) then
    raise exception 'You have already given your clue.';
  end if;
  perform public.advance_clue_turn(p_room_id, auth.uid(), trim(p_clue));
end;
$$;

create or replace function public.skip_expired_clue(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.game_sessions%rowtype;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found then raise exception 'The game has not started.'; end if;
  if v_game.phase <> 'clue' or v_game.turn_deadline is null or v_game.turn_deadline > now() then
    return false;
  end if;
  if exists (
    select 1 from public.game_clues
    where room_id = p_room_id and round_number = v_game.round_number
      and player_id = v_game.current_turn_player_id
  ) then
    return false;
  end if;
  perform public.advance_clue_turn(p_room_id, v_game.current_turn_player_id, '(no clue — time expired)');
  return true;
end;
$$;

create or replace function public.start_next_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_player uuid;
  v_timer integer;
begin
  select p.id into v_first_player
  from public.game_secrets s
  cross join lateral unnest(s.turn_order) with ordinality as ordered(player_id, turn_position)
  join public.players p on p.id = ordered.player_id and p.room_id = p_room_id
  where s.room_id = p_room_id and not p.is_eliminated
  order by ordered.turn_position
  limit 1;
  if v_first_player is null then raise exception 'No active players remain.'; end if;

  select (settings->>'clueTimer')::integer into v_timer from public.rooms where id = p_room_id;
  update public.game_secrets set votes = '{}'::jsonb where room_id = p_room_id;
  update public.game_sessions
  set round_number = round_number + 1,
      phase = 'clue',
      current_turn_player_id = v_first_player,
      eliminated_player_id = null,
      turn_deadline = now() + make_interval(secs => v_timer)
  where room_id = p_room_id;
end;
$$;

create or replace function public.cast_vote(p_room_id uuid, p_target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.game_sessions%rowtype;
  v_votes jsonb;
  v_count integer;
  v_player_count integer;
  v_eliminated uuid;
  v_imposters uuid[];
  v_final_guess_enabled boolean;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  if exists (
    select 1 from public.players where room_id = p_room_id and id = auth.uid() and is_eliminated
  ) then raise exception 'Eliminated players cannot vote.'; end if;
  if p_target_player_id = auth.uid() then raise exception 'You cannot vote for yourself.'; end if;
  if not exists (
    select 1 from public.players where room_id = p_room_id and id = p_target_player_id and not is_eliminated
  ) then
    raise exception 'That player is not in this game.';
  end if;

  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found or v_game.phase <> 'vote' then raise exception 'Voting is not open.'; end if;
  select votes into v_votes from public.game_secrets where room_id = p_room_id;
  if v_votes ? auth.uid()::text then raise exception 'You have already voted.'; end if;

  v_votes := v_votes || jsonb_build_object(auth.uid()::text, p_target_player_id::text);
  update public.game_secrets set votes = v_votes where room_id = p_room_id;
  select count(*) into v_player_count from public.players where room_id = p_room_id and not is_eliminated;
  select count(*) into v_count from jsonb_each(v_votes);
  if v_count < v_player_count then return; end if;

  select target_id into v_eliminated
  from (
    select value::uuid as target_id, count(*) as votes
    from jsonb_each_text(v_votes)
    group by value
    order by count(*) desc, random()
    limit 1
  ) tally;
  select imposter_ids, final_guess_enabled into v_imposters, v_final_guess_enabled
  from public.game_secrets where room_id = p_room_id;

  update public.players set is_eliminated = true
  where room_id = p_room_id and id = v_eliminated;

  if not (v_eliminated = any(v_imposters)) then
    update public.game_sessions
    set phase = 'result', eliminated_player_id = v_eliminated, winner = 'imposters', turn_deadline = null
    where room_id = p_room_id;
    update public.rooms set status = 'finished' where id = p_room_id;
  elsif v_final_guess_enabled then
    update public.game_sessions
    set phase = 'final_guess', eliminated_player_id = v_eliminated, turn_deadline = null
    where room_id = p_room_id;
  elsif exists (
    select 1 from unnest(v_imposters) as imposters(id)
    where not exists (
      select 1 from public.players p
      where p.room_id = p_room_id and p.id = imposters.id and p.is_eliminated
    )
  ) then
    perform public.start_next_round(p_room_id);
  else
    update public.game_sessions
    set phase = 'result',
        eliminated_player_id = v_eliminated,
        winner = 'civilians',
        turn_deadline = null
    where room_id = p_room_id;
    update public.rooms set status = 'finished' where id = p_room_id;
  end if;
end;
$$;

create or replace function public.get_my_vote_status(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_votes jsonb;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  select votes into v_votes from public.game_secrets where room_id = p_room_id;
  if not found then raise exception 'The game has not started.'; end if;
  return v_votes ? auth.uid()::text;
end;
$$;

create or replace function public.submit_final_guess(p_room_id uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret public.game_secrets%rowtype;
  v_game public.game_sessions%rowtype;
  v_correct boolean;
begin
  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found or v_game.phase <> 'final_guess' or v_game.eliminated_player_id <> auth.uid() then
    raise exception 'You cannot make the final guess.';
  end if;
  select * into v_secret from public.game_secrets where room_id = p_room_id;
  v_correct := lower(trim(coalesce(p_guess, ''))) = lower(v_secret.word);

  if v_correct then
    update public.game_sessions set phase = 'result', winner = 'imposters' where room_id = p_room_id;
    update public.rooms set status = 'finished' where id = p_room_id;
  elsif exists (
    select 1 from unnest(v_secret.imposter_ids) as imposters(id)
    where not exists (
      select 1 from public.players p
      where p.room_id = p_room_id and p.id = imposters.id and p.is_eliminated
    )
  ) then
    perform public.start_next_round(p_room_id);
  else
    update public.game_sessions set phase = 'result', winner = 'civilians' where room_id = p_room_id;
    update public.rooms set status = 'finished' where id = p_room_id;
  end if;
end;
$$;

create or replace function public.get_game_result(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.game_sessions%rowtype;
  v_secret public.game_secrets%rowtype;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  select * into v_session from public.game_sessions where room_id = p_room_id;
  if not found or v_session.phase <> 'result' then raise exception 'The game is not finished.'; end if;
  select * into v_secret from public.game_secrets where room_id = p_room_id;

  return jsonb_build_object(
    'word', v_secret.word,
    'winner', v_session.winner,
    'eliminated_player_id', v_session.eliminated_player_id,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', p.id,
        'is_imposter', p.id = any(v_secret.imposter_ids),
        'vote_count', coalesce(vote_counts.vote_count, 0)
      ) order by p.joined_at)
      from public.players p
      left join (
        select value as player_id, count(*) as vote_count
        from jsonb_each_text(v_secret.votes)
        group by value
      ) vote_counts on vote_counts.player_id = p.id::text
      where p.room_id = p_room_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.players where room_id = p_room_id and id = auth.uid()) then
    raise exception 'You are not in this room.';
  end if;
  if exists (select 1 from public.rooms where id = p_room_id and host_id = auth.uid()) then
    delete from public.rooms where id = p_room_id;
  else
    delete from public.players where room_id = p_room_id and id = auth.uid();
  end if;
end;
$$;

revoke all on function public.create_room(text, jsonb) from public, anon;
revoke all on function public.join_room(text, text) from public, anon;
revoke all on function public.update_room_settings(uuid, jsonb) from public, anon;
revoke all on function public.set_player_ready(uuid, boolean) from public, anon;
revoke all on function public.start_game(uuid) from public, anon;
revoke all on function public.get_my_role(uuid) from public, anon;
revoke all on function public.submit_clue(uuid, text) from public, anon;
revoke all on function public.advance_clue_turn(uuid, uuid, text) from public, anon;
revoke all on function public.skip_expired_clue(uuid) from public, anon;
revoke all on function public.cast_vote(uuid, uuid) from public, anon;
revoke all on function public.get_my_vote_status(uuid) from public, anon;
revoke all on function public.start_next_round(uuid) from public, anon;
revoke all on function public.submit_final_guess(uuid, text) from public, anon;
revoke all on function public.get_game_result(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;

grant execute on function public.create_room(text, jsonb) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.update_room_settings(uuid, jsonb) to authenticated;
grant execute on function public.set_player_ready(uuid, boolean) to authenticated;
grant execute on function public.start_game(uuid) to authenticated;
grant execute on function public.get_my_role(uuid) to authenticated;
grant execute on function public.submit_clue(uuid, text) to authenticated;
grant execute on function public.skip_expired_clue(uuid) to authenticated;
grant execute on function public.cast_vote(uuid, uuid) to authenticated;
grant execute on function public.get_my_vote_status(uuid) to authenticated;
grant execute on function public.submit_final_guess(uuid, text) to authenticated;
grant execute on function public.get_game_result(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.game_sessions;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.game_clues;
exception when duplicate_object then null;
end;
$$;
