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

  async function getSeasons() {
    if (!client) return [];
    const { data, error } = await client
      .from("runs")
      .select("season")
      .eq("validated", true)
      .order("season", { ascending: false });
    if (error) throw error;
    return [...new Set(data.map((row) => Number(row.season)).filter(Number.isInteger))];
  }

  async function getLeaderboard(season) {
    if (!client) return null;
    const { data, error } = await client
      .from("leaderboard")
      .select("rider_id,pseudo,avatar_path,season,run_count,best_time_cs,last_run_at")
      .eq("season", season)
      .order("best_time_cs", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({
      riderId: row.rider_id,
      rider: row.pseudo,
      avatarUrl: publicAvatarUrl(row.avatar_path),
      season: Number(row.season),
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

  async function addRun(elapsedCentiseconds, season) {
    if (!client) throw new Error("Le classement partagé est indisponible.");
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("Connecte-toi pour enregistrer un chrono.");
    const { error } = await client.from("runs").insert({
      rider_id: userData.user.id,
      elapsed_centiseconds: elapsedCentiseconds,
      season,
      source: "manual-web",
      validated: true
    });
    if (error) throw error;
  }

  async function uploadAvatar(userId, file) {
    if (!file) return null;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
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
      .update({ avatar_path: path, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) throw profileError;
    return publicAvatarUrl(path);
  }

  window.foilRaceBackend = {
    configured,
    client,
    getSeasons,
    getLeaderboard,
    getProfile,
    addRun,
    uploadAvatar
  };
})();
