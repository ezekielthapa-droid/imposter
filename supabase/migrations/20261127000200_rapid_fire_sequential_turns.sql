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
  v_turn_seconds integer;
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

  v_turn_seconds := case
    when v_room.settings->>'gameMode' = 'rapid' then 20
    else (v_room.settings->>'clueTimer')::integer
  end;
  insert into public.game_secrets (room_id, word, category, imposter_ids, turn_order, final_guess_enabled)
  values (p_room_id, v_word, v_word_category, v_imposters, v_order, (v_room.settings->>'finalGuess')::boolean);
  insert into public.game_sessions (room_id, phase, current_turn_player_id, turn_deadline)
  values (p_room_id, 'clue', v_order[1], now() + make_interval(secs => v_turn_seconds));
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
begin
  insert into public.game_clues (room_id, round_number, player_id, clue)
  select p_room_id, round_number, p_player_id, p_clue
  from public.game_sessions
  where room_id = p_room_id and phase = 'clue';

  select turn_order into v_turn_order from public.game_secrets where room_id = p_room_id;
  select case when settings->>'gameMode' = 'rapid' then 20 else (settings->>'clueTimer')::integer end
    into v_timer from public.rooms where id = p_room_id;

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
        turn_deadline = now() + make_interval(secs => v_timer)
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
    where room_id = p_room_id
      and round_number = v_game.round_number
      and player_id = v_game.current_turn_player_id
  ) then
    return false;
  end if;
  perform public.advance_clue_turn(
    p_room_id,
    v_game.current_turn_player_id,
    '(no clue — time expired)'
  );
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

  select case when settings->>'gameMode' = 'rapid' then 20 else (settings->>'clueTimer')::integer end
    into v_timer from public.rooms where id = p_room_id;
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
