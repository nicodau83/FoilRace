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
    const { data: existingProfile } = await client
      .from("profiles")
      .select("avatar_path")
      .eq("id", userId)
      .single();
    const path = `${userId}/profile-${Date.now()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    const { error: profileError } = await client
      .from("profiles")
      .update({ avatar_path: path, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) throw profileError;
    if (existingProfile?.avatar_path && existingProfile.avatar_path !== path) {
      await client.storage.from("avatars").remove([existingProfile.avatar_path]);
    }
    return publicAvatarUrl(path);
  }

  function isAdmin(user) {
    return user?.app_metadata?.role === "admin";
  }

  async function getAdminData() {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !isAdmin(userData.user)) throw new Error("Accès administrateur refusé.");

    const [profilesResult, runsResult] = await Promise.all([
      client.from("profiles").select("id,pseudo,avatar_path,created_at").order("pseudo"),
      client.from("runs").select("id,rider_id,elapsed_centiseconds,season,recorded_at,validated").order("recorded_at", { ascending: false })
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (runsResult.error) throw runsResult.error;

    const profiles = profilesResult.data;
    const pseudoById = new Map(profiles.map((profile) => [profile.id, profile.pseudo]));
    const runs = runsResult.data.map((run) => ({
      ...run,
      pseudo: pseudoById.get(run.rider_id) || "Rider supprimé"
    }));
    return { profiles, runs, adminUserId: userData.user.id };
  }

  async function updateRun(runId, elapsedCentiseconds) {
    if (!Number.isInteger(elapsedCentiseconds) || elapsedCentiseconds <= 0) {
      throw new Error("Le chrono doit être supérieur à zéro.");
    }
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !isAdmin(userData.user)) throw new Error("Accès administrateur refusé.");
    const { data, error } = await client
      .from("runs")
      .update({ elapsed_centiseconds: elapsedCentiseconds })
      .eq("id", runId)
      .select("id,elapsed_centiseconds")
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteRun(runId) {
    const { error } = await client.from("runs").delete().eq("id", runId);
    if (error) throw error;
  }

  async function deleteRider(profile) {
    if (profile.avatar_path) {
      const { error: storageError } = await client.storage.from("avatars").remove([profile.avatar_path]);
      if (storageError) throw storageError;
    }
    const { error } = await client.from("profiles").delete().eq("id", profile.id);
    if (error) throw error;
  }

  window.foilRaceBackend = {
    configured,
    client,
    getSeasons,
    getLeaderboard,
    getProfile,
    addRun,
    uploadAvatar,
    isAdmin,
    getAdminData,
    updateRun,
    deleteRun,
    deleteRider
  };
})();
