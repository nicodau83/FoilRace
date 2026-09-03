(function createFoilRaceBackend() {
  const config = window.FOILRACE_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  const client = configured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  function publicAvatarUrl(path) {
    if (!client || !path) return null;
    return client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  async function getLeaderboard() {
    if (!client) return null;
    const { data, error } = await client
      .from("leaderboard")
      .select("rider_id,pseudo,avatar_path,run_count,best_time_cs,last_run_at")
      .order("best_time_cs", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({
      riderId: row.rider_id,
      rider: row.pseudo,
      avatarUrl: publicAvatarUrl(row.avatar_path),
      runs: Number(row.run_count),
      best: Number(row.best_time_cs),
      recordedAt: row.last_run_at
    }));
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from("profiles")
      .select("id,pseudo,avatar_path")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return { ...data, avatarUrl: publicAvatarUrl(data.avatar_path) };
  }

  async function uploadAvatar(userId, file) {
    if (!file) return null;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      throw new Error("Choisis une image JPG, PNG ou WebP de moins de 5 Mo.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/profile.${extension}`;
    const { error: uploadError } = await client.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    const { error: profileError } = await client
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);
    if (profileError) throw profileError;
    return publicAvatarUrl(path);
  }

  window.foilRaceBackend = { configured, client, getLeaderboard, getProfile, uploadAvatar };
})();
