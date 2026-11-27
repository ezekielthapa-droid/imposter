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
    'gameMode', case when p_settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end,
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
    'gameMode', case when p_settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end,
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
  v_round_seconds integer;
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

  v_round_seconds := case
    when v_room.settings->>'gameMode' = 'rapid' then 60
    else (v_room.settings->>'clueTimer')::integer
  end;

  insert into public.game_secrets (room_id, word, category, imposter_ids, turn_order, final_guess_enabled)
  values (p_room_id, v_word, v_word_category, v_imposters, v_order, (v_room.settings->>'finalGuess')::boolean);
  insert into public.game_sessions (room_id, phase, current_turn_player_id, turn_deadline)
  values (
    p_room_id,
    'clue',
    case when v_room.settings->>'gameMode' = 'rapid' then null else v_order[1] end,
    now() + make_interval(secs => v_round_seconds)
  );
  update public.rooms set status = 'playing' where id = p_room_id;
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
  v_game_mode text;
  v_deadline timestamptz;
begin
  insert into public.game_clues (room_id, round_number, player_id, clue)
  select p_room_id, round_number, p_player_id, p_clue
  from public.game_sessions
  where room_id = p_room_id and phase = 'clue';

  select turn_order into v_turn_order from public.game_secrets where room_id = p_room_id;
  select (settings->>'clueTimer')::integer,
         case when settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end
    into v_timer, v_game_mode
  from public.rooms where id = p_room_id;
  select turn_deadline into v_deadline from public.game_sessions where room_id = p_room_id;
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
    update public.game_sessions
    set current_turn_player_id = v_next_player,
        turn_deadline = case
          when v_game_mode = 'rapid' then v_deadline
          else now() + make_interval(secs => v_timer)
        end
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
  v_game_mode text;
  v_player_count integer;
  v_clue_count integer;
begin
  if char_length(trim(coalesce(p_clue, ''))) not between 1 and 80 then
    raise exception 'A clue must be between 1 and 80 characters.';
  end if;
  select case when settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end
    into v_game_mode from public.rooms where id = p_room_id;
  if v_game_mode = 'rapid' and trim(p_clue) ~ '[[:space:]]' then
    raise exception 'Rapid Fire clues must be one word.';
  end if;

  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found or v_game.phase <> 'clue' then raise exception 'The clue round is not open.'; end if;
  if v_game.turn_deadline <= now() then raise exception 'The clue round has expired.'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  if exists (
    select 1 from public.players
    where room_id = p_room_id and id = auth.uid() and is_eliminated
  ) then raise exception 'Eliminated players cannot give clues.'; end if;
  if exists (
    select 1 from public.game_clues
    where room_id = p_room_id and round_number = v_game.round_number and player_id = auth.uid()
  ) then
    raise exception 'You have already given your clue.';
  end if;

  if v_game_mode = 'rapid' then
    insert into public.game_clues (room_id, round_number, player_id, clue)
    values (p_room_id, v_game.round_number, auth.uid(), trim(p_clue));

    select count(*) into v_player_count
    from public.players where room_id = p_room_id and not is_eliminated;
    select count(*) into v_clue_count
    from public.game_clues
    where room_id = p_room_id and round_number = v_game.round_number;
    if v_clue_count >= v_player_count then
      update public.game_sessions
      set phase = 'vote', current_turn_player_id = null, turn_deadline = null
      where room_id = p_room_id;
    end if;
    return;
  end if;

  if v_game.current_turn_player_id <> auth.uid() then
    raise exception 'It is not your turn to give a clue.';
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
  v_game_mode text;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;
  select * into v_game from public.game_sessions where room_id = p_room_id for update;
  if not found then raise exception 'The game has not started.'; end if;
  if v_game.phase <> 'clue' or v_game.turn_deadline is null or v_game.turn_deadline > now() then
    return false;
  end if;
  select case when settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end
    into v_game_mode from public.rooms where id = p_room_id;

  if v_game_mode = 'rapid' then
    insert into public.game_clues (room_id, round_number, player_id, clue)
    select p_room_id, v_game.round_number, ordered.player_id, '(no clue — time expired)'
    from public.game_secrets s
    cross join lateral unnest(s.turn_order) as ordered(player_id)
    join public.players p on p.room_id = p_room_id and p.id = ordered.player_id
    where s.room_id = p_room_id
      and not p.is_eliminated
      and not exists (
        select 1 from public.game_clues c
        where c.room_id = p_room_id
          and c.round_number = v_game.round_number
          and c.player_id = ordered.player_id
      );
    update public.game_sessions
    set phase = 'vote', current_turn_player_id = null, turn_deadline = null
    where room_id = p_room_id;
    return true;
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
  v_game_mode text;
begin
  select p.id into v_first_player
  from public.game_secrets s
  cross join lateral unnest(s.turn_order) with ordinality as ordered(player_id, turn_position)
  join public.players p on p.id = ordered.player_id and p.room_id = p_room_id
  where s.room_id = p_room_id and not p.is_eliminated
  order by ordered.turn_position
  limit 1;
  if v_first_player is null then raise exception 'No active players remain.'; end if;

  select (settings->>'clueTimer')::integer,
         case when settings->>'gameMode' = 'rapid' then 'rapid' else 'classic' end
    into v_timer, v_game_mode
  from public.rooms where id = p_room_id;
  update public.game_secrets set votes = '{}'::jsonb where room_id = p_room_id;
  update public.game_sessions
  set round_number = round_number + 1,
      phase = 'clue',
      current_turn_player_id = case when v_game_mode = 'rapid' then null else v_first_player end,
      eliminated_player_id = null,
      turn_deadline = now() + make_interval(secs => case when v_game_mode = 'rapid' then 60 else v_timer end)
  where room_id = p_room_id;
end;
$$;
