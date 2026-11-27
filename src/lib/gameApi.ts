import { ensureGuestSession, getSupabaseClient } from "./supabase";

export type GameSettings = {
  gameMode: "classic" | "rapid";
  maxPlayers: number;
  imposters: number;
  category: string;
  difficulty: string;
  clueTimer: number;
  imposterHint: "category" | "none";
  finalGuess: boolean;
  customRules: string;
};

export type Room = {
  id: string;
  code: string;
  host_id: string;
  status: "lobby" | "playing" | "finished";
  settings: GameSettings;
};

export type Player = {
  id: string;
  room_id: string;
  display_name: string;
  avatar: string;
  is_ready: boolean;
  is_eliminated: boolean;
  joined_at: string;
};

export type GameSession = {
  room_id: string;
  phase: "clue" | "vote" | "final_guess" | "result";
  round_number: number;
  current_turn_player_id: string | null;
  eliminated_player_id: string | null;
  turn_deadline: string | null;
  winner: "civilians" | "imposters" | null;
};

export type GameClue = {
  id: number;
  round_number: number;
  player_id: string;
  clue: string;
};

export type GameRole = {
  is_imposter: boolean;
  word: string | null;
  category: string | null;
  category_hint: string | null;
};

export type GameResult = {
  word: string;
  winner: "civilians" | "imposters";
  eliminated_player_id: string | null;
  players: Array<{ player_id: string; is_imposter: boolean; vote_count: number }>;
};

type RoomResponse = { room_id: string; code: string };

function unwrapRpc<T>(data: unknown, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function saveRoomIdentity(roomId: string, displayName: string, avatar: string) {
  const { data, error } = await getSupabaseClient().rpc("update_my_identity", {
    p_room_id: roomId,
    p_display_name: displayName,
    p_avatar: avatar,
  });
  unwrapRpc<null>(data, error);
}

export async function createRoom(displayName: string, settings: GameSettings, avatar: string) {
  await ensureGuestSession();
  const { data, error } = await getSupabaseClient().rpc("create_room", {
    p_display_name: displayName,
    p_settings: settings,
  });
  const room = unwrapRpc<RoomResponse>(data, error);
  await saveRoomIdentity(room.room_id, displayName, avatar);
  return room;
}

export async function joinRoom(code: string, displayName: string, avatar: string) {
  await ensureGuestSession();
  const { data, error } = await getSupabaseClient().rpc("join_room", {
    p_code: code,
    p_display_name: displayName,
  });
  const room = unwrapRpc<RoomResponse>(data, error);
  await saveRoomIdentity(room.room_id, displayName, avatar);
  return room;
}

export async function updateMyIdentity(roomId: string, displayName: string, avatar: string) {
  await saveRoomIdentity(roomId, displayName, avatar);
}

export async function updateRoomSettings(roomId: string, settings: GameSettings) {
  const { data, error } = await getSupabaseClient().rpc("update_room_settings", {
    p_room_id: roomId,
    p_settings: settings,
  });
  unwrapRpc<null>(data, error);
}

export async function setReady(roomId: string, ready: boolean) {
  const { data, error } = await getSupabaseClient().rpc("set_player_ready", {
    p_room_id: roomId,
    p_ready: ready,
  });
  unwrapRpc<null>(data, error);
}

export async function startGame(roomId: string) {
  const { data, error } = await getSupabaseClient().rpc("start_game", { p_room_id: roomId });
  unwrapRpc<null>(data, error);
}

export async function leaveRoom(roomId: string) {
  const { data, error } = await getSupabaseClient().rpc("leave_room", { p_room_id: roomId });
  unwrapRpc<null>(data, error);
}

export async function loadRoom(roomId: string) {
  const supabase = getSupabaseClient();
  const [roomResult, playersResult, gameResult, cluesResult, userResult] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).single(),
    supabase.from("players").select("*").eq("room_id", roomId).order("joined_at"),
    supabase.from("game_sessions").select("*").eq("room_id", roomId).maybeSingle(),
    supabase.from("game_clues").select("*").eq("room_id", roomId).order("created_at"),
    supabase.auth.getUser(),
  ]);
  if (roomResult.error) throw new Error(roomResult.error.message);
  if (playersResult.error) throw new Error(playersResult.error.message);
  if (gameResult.error) throw new Error(gameResult.error.message);
  if (cluesResult.error) throw new Error(cluesResult.error.message);
  if (userResult.error) throw new Error(userResult.error.message);
  if (!userResult.data.user)
    throw new Error("Your guest session has expired. Reload the page to rejoin.");
  let hasVoted = false;
  if (gameResult.data?.phase === "vote") {
    const voteResult = await supabase.rpc("get_my_vote_status", { p_room_id: roomId });
    hasVoted = unwrapRpc<boolean>(voteResult.data, voteResult.error);
  }

  return {
    room: roomResult.data as Room,
    players: playersResult.data as Player[],
    game: gameResult.data as GameSession | null,
    clues: cluesResult.data as GameClue[],
    userId: userResult.data.user.id,
    hasVoted,
  };
}

export async function getMyRole(roomId: string) {
  const { data, error } = await getSupabaseClient().rpc("get_my_role", { p_room_id: roomId });
  return unwrapRpc<GameRole>(data, error);
}

export async function submitClue(roomId: string, clue: string) {
  const { data, error } = await getSupabaseClient().rpc("submit_clue", {
    p_room_id: roomId,
    p_clue: clue,
  });
  unwrapRpc<null>(data, error);
}

export async function skipExpiredClue(roomId: string) {
  const { data, error } = await getSupabaseClient().rpc("skip_expired_clue", {
    p_room_id: roomId,
  });
  return unwrapRpc<boolean>(data, error);
}

export async function castVote(roomId: string, playerId: string) {
  const { data, error } = await getSupabaseClient().rpc("cast_vote", {
    p_room_id: roomId,
    p_target_player_id: playerId,
  });
  unwrapRpc<null>(data, error);
}

export async function submitFinalGuess(roomId: string, guess: string) {
  const { data, error } = await getSupabaseClient().rpc("submit_final_guess", {
    p_room_id: roomId,
    p_guess: guess,
  });
  unwrapRpc<null>(data, error);
}

export async function getGameResult(roomId: string) {
  const { data, error } = await getSupabaseClient().rpc("get_game_result", { p_room_id: roomId });
  return unwrapRpc<GameResult>(data, error);
}
