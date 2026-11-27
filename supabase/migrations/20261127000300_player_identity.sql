alter table public.players
add column if not exists avatar text not null default '👀'
check (char_length(avatar) <= 100000);

create or replace function public.update_my_identity(
  p_room_id uuid,
  p_display_name text,
  p_avatar text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := left(trim(coalesce(p_display_name, '')), 24);
  v_avatar text := coalesce(p_avatar, '👀');
begin
  if v_name = '' then raise exception 'Enter a player name.'; end if;
  if char_length(v_avatar) > 100000 then raise exception 'That avatar image is too large.'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'You are not a player in this game.'; end if;

  update public.players
  set display_name = v_name, avatar = v_avatar
  where room_id = p_room_id and id = auth.uid();
end;
$$;

revoke all on function public.update_my_identity(uuid, text, text) from public, anon;
grant execute on function public.update_my_identity(uuid, text, text) to authenticated;

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
    'category', v_secret.category,
    'category_hint', case
      when v_is_imposter and v_settings->>'imposterHint' = 'category' then v_secret.category
      else null
    end
  );
end;
$$;

revoke all on function public.get_my_role(uuid) from public, anon;
grant execute on function public.get_my_role(uuid) to authenticated;
