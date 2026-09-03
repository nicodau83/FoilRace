const SAMPLE_RUNS = [
  { rider: "MaloFoil", time: 3842, season: 2026, recordedAt: "2026-08-30T15:22:00Z" },
  { rider: "Nico83", time: 4017, season: 2026, recordedAt: "2026-08-31T10:13:00Z" },
  { rider: "MaloFoil", time: 3768, season: 2026, recordedAt: "2026-09-01T14:18:00Z" },
  { rider: "LinaRide", time: 4241, season: 2026, recordedAt: "2026-08-29T09:04:00Z" },
  { rider: "TomAir", time: 3995, season: 2026, recordedAt: "2026-09-01T17:42:00Z" },
  { rider: "Nico83", time: 3926, season: 2026, recordedAt: "2026-09-01T18:01:00Z" },
  { rider: "CamFoil", time: 4410, season: 2026, recordedAt: "2026-08-28T11:32:00Z" }
];

const STORAGE_KEY = "foilrace-runs-v2";
const FIRST_SEASON = 2026;
const CURRENT_SEASON = new Date().getFullYear();
let deferredInstallPrompt = null;
let sharedRanking = null;
let currentProfile = null;

const rankingList = document.querySelector("#rankingList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const seasonSelect = document.querySelector("#seasonSelect");
const runForm = document.querySelector("#runForm");
const submitRun = document.querySelector("#submitRun");
const runIdentity = document.querySelector("#runIdentity");
const runRider = document.querySelector("#runRider");
const formMessage = document.querySelector("#formMessage");
const installButton = document.querySelector("#installButton");

function readRuns() {
  if (sharedRanking) return sharedRanking;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : SAMPLE_RUNS;
  } catch {
    return SAMPLE_RUNS;
  }
}

function availableBaseSeasons() {
  const years = [];
  for (let year = CURRENT_SEASON; year >= FIRST_SEASON; year -= 1) years.push(year);
  return years;
}

function fillSeasonSelect(extraSeasons = []) {
  const selected = Number(seasonSelect.value) || CURRENT_SEASON;
  const seasons = [...new Set([...availableBaseSeasons(), ...extraSeasons])]
    .filter((year) => Number.isInteger(year) && year >= FIRST_SEASON)
    .sort((a, b) => b - a);
  seasonSelect.replaceChildren(...seasons.map((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    return option;
  }));
  seasonSelect.value = String(seasons.includes(selected) ? selected : seasons[0]);
}

async function loadSharedRanking() {
  const backend = window.foilRaceBackend;
  if (!backend?.configured) {
    sharedRanking = null;
    fillSeasonSelect(SAMPLE_RUNS.map((run) => run.season));
    renderRanking();
    updateRunAccess(null);
    return;
  }
  try {
    const seasons = await backend.getSeasons();
    fillSeasonSelect(seasons);
    sharedRanking = await backend.getLeaderboard(Number(seasonSelect.value));
    renderRanking();
  } catch (error) {
    console.error("Classement partagé indisponible", error);
    formMessage.textContent = "Le classement est momentanément indisponible.";
  }
}

function formatTime(centiseconds) {
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const hundredths = centiseconds % 100;
  const secondsPart = minutes ? String(seconds).padStart(2, "0") : String(seconds);
  return `${minutes ? `${minutes}:` : ""}${secondsPart},${String(hundredths).padStart(2, "0")} s`;
}

function initials(name) {
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "FR";
}

function createAvatar(entry) {
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  if (!entry.avatarUrl) {
    avatar.textContent = initials(entry.rider);
    avatar.setAttribute("aria-hidden", "true");
    return avatar;
  }
  const photo = document.createElement("img");
  photo.src = entry.avatarUrl;
  photo.alt = `Photo de ${entry.rider}`;
  photo.loading = "lazy";
  photo.referrerPolicy = "no-referrer";
  photo.addEventListener("error", () => {
    avatar.replaceChildren(document.createTextNode(initials(entry.rider)));
    avatar.setAttribute("aria-hidden", "true");
  }, { once: true });
  avatar.append(photo);
  return avatar;
}

function buildRanking(runs) {
  if (sharedRanking) return runs;
  const selectedSeason = Number(seasonSelect.value);
  const riders = new Map();
  runs.filter((run) => Number(run.season || FIRST_SEASON) === selectedSeason).forEach((run) => {
    const key = run.rider.toLocaleLowerCase("fr");
    const current = riders.get(key) || { rider: run.rider, avatarUrl: null, runs: 0, best: Infinity };
    current.avatarUrl = run.avatarUrl || current.avatarUrl;
    current.runs += 1;
    current.best = Math.min(current.best, run.time);
    current.recordedAt = !current.recordedAt || Date.parse(run.recordedAt) > Date.parse(current.recordedAt)
      ? run.recordedAt
      : current.recordedAt;
    riders.set(key, current);
  });
  return [...riders.values()].sort((a, b) => a.best - b.best || a.rider.localeCompare(b.rider, "fr"));
}

function renderRanking() {
  const query = searchInput.value.trim().toLocaleLowerCase("fr");
  const ranking = buildRanking(readRuns()).filter((entry) =>
    entry.rider.toLocaleLowerCase("fr").includes(query)
  );

  rankingList.replaceChildren(...ranking.map((entry, index) => {
    const item = document.createElement("li");
    item.className = "ranking-row";
    item.innerHTML = `
      <span class="rank">${String(index + 1).padStart(2, "0")}</span>
      <span class="rider">
        <span class="avatar-slot"></span>
        <span><span class="rider-name"></span></span>
      </span>
      <span class="runs">${entry.runs} run${entry.runs > 1 ? "s" : ""}</span>
      <span class="best-time">${formatTime(entry.best)}</span>`;
    item.querySelector(".rider-name").textContent = entry.rider;
    item.querySelector(".avatar-slot").replaceWith(createAvatar(entry));
    return item;
  }));

  emptyState.hidden = ranking.length > 0;
  const latest = readRuns().reduce((last, run) => Math.max(last, Date.parse(run.recordedAt) || 0), 0);
  document.querySelector("#lastUpdate").textContent = latest
    ? `MISE À JOUR ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(latest)}`
    : "";
}

function updateRunAccess(profile) {
  currentProfile = profile;
  const connected = Boolean(profile && window.foilRaceBackend?.configured);
  submitRun.disabled = !connected;
  submitRun.textContent = connected ? "Ajouter mon chrono" : "Se connecter pour enregistrer";
  runRider.textContent = connected ? `RIDER · ${profile.pseudo}` : "CONNEXION REQUISE";
  runIdentity.textContent = connected
    ? `Ce chrono sera enregistré sur le compte de ${profile.pseudo}, pour la saison ${CURRENT_SEASON}.`
    : "Connecte-toi à ton compte rider pour enregistrer un chrono.";
  if (!connected) runForm.reset();
}

searchInput.addEventListener("input", renderRanking);
seasonSelect.addEventListener("change", loadSharedRanking);

runForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentProfile || !window.foilRaceBackend?.configured) {
    formMessage.textContent = "Connecte-toi à ton compte rider.";
    document.querySelector("#accountButton").click();
    return;
  }
  const seconds = Number(document.querySelector("#seconds").value);
  const centiseconds = Number(document.querySelector("#centiseconds").value);
  if (!Number.isInteger(seconds) || !Number.isInteger(centiseconds) || seconds < 0 || centiseconds < 0 || centiseconds > 99) {
    formMessage.textContent = "Vérifie le temps saisi.";
    return;
  }
  const elapsed = seconds * 100 + centiseconds;
  if (elapsed <= 0) {
    formMessage.textContent = "Le chrono doit être supérieur à zéro.";
    return;
  }
  submitRun.disabled = true;
  formMessage.textContent = "Enregistrement…";
  try {
    await window.foilRaceBackend.addRun(elapsed, CURRENT_SEASON);
    runForm.reset();
    seasonSelect.value = String(CURRENT_SEASON);
    formMessage.textContent = `Chrono enregistré en ${formatTime(elapsed)} pour ${currentProfile.pseudo}.`;
    await loadSharedRanking();
    document.querySelector("#classement").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    formMessage.textContent = error.message || "Impossible d’enregistrer le chrono.";
  } finally {
    submitRun.disabled = !currentProfile;
  }
});

window.addEventListener("foilrace-auth-changed", (event) => updateRunAccess(event.detail?.profile || null));
window.addEventListener("foilrace-profile-updated", loadSharedRanking);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => { installButton.hidden = true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

fillSeasonSelect(SAMPLE_RUNS.map((run) => run.season));
renderRanking();
loadSharedRanking();
