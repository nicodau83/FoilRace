const SAMPLE_RUNS = [
  { rider: "MaloFoil", time: 3842, recordedAt: "2026-08-30T15:22:00Z" },
  { rider: "Nico83", time: 4017, recordedAt: "2026-08-31T10:13:00Z" },
  { rider: "MaloFoil", time: 3768, recordedAt: "2026-09-01T14:18:00Z" },
  { rider: "LinaRide", time: 4241, recordedAt: "2026-08-29T09:04:00Z" },
  { rider: "TomAir", time: 3995, recordedAt: "2026-09-01T17:42:00Z" },
  { rider: "Nico83", time: 3926, recordedAt: "2026-09-01T18:01:00Z" },
  { rider: "CamFoil", time: 4410, recordedAt: "2026-08-28T11:32:00Z" }
];

const STORAGE_KEY = "foilrace-runs-v1";
let deferredInstallPrompt = null;

const rankingList = document.querySelector("#rankingList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const runForm = document.querySelector("#runForm");
const formMessage = document.querySelector("#formMessage");
const installButton = document.querySelector("#installButton");

function readRuns() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : SAMPLE_RUNS;
  } catch {
    return SAMPLE_RUNS;
  }
}

function saveRuns(runs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
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

function buildRanking(runs) {
  const riders = new Map();
  runs.forEach((run) => {
    const key = run.rider.toLocaleLowerCase("fr");
    const current = riders.get(key) || { rider: run.rider, runs: 0, best: Infinity };
    current.runs += 1;
    current.best = Math.min(current.best, run.time);
    riders.set(key, current);
  });
  return [...riders.values()].sort((a, b) => a.best - b.best || a.rider.localeCompare(b.rider, "fr"));
}

function renderRanking() {
  const query = searchInput.value.trim().toLocaleLowerCase("fr");
  const ranking = buildRanking(readRuns()).filter((entry) => {
    return entry.rider.toLocaleLowerCase("fr").includes(query);
  });

  rankingList.replaceChildren(...ranking.map((entry, index) => {
    const item = document.createElement("li");
    item.className = "ranking-row";
    item.innerHTML = `
      <span class="rank">${String(index + 1).padStart(2, "0")}</span>
      <span class="rider">
        <span class="avatar" aria-hidden="true">${initials(entry.rider)}</span>
        <span><span class="rider-name"></span></span>
      </span>
      <span class="runs">${entry.runs} run${entry.runs > 1 ? "s" : ""}</span>
      <span class="best-time">${formatTime(entry.best)}</span>`;
    item.querySelector(".rider-name").textContent = entry.rider;
    return item;
  }));

  emptyState.hidden = ranking.length > 0;
  const latest = readRuns().reduce((last, run) => Math.max(last, Date.parse(run.recordedAt) || 0), 0);
  document.querySelector("#lastUpdate").textContent = latest
    ? `MISE À JOUR ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(latest)}`
    : "";
}

searchInput.addEventListener("input", renderRanking);

runForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const rider = document.querySelector("#riderName").value.trim();
  const seconds = Number(document.querySelector("#seconds").value);
  const centiseconds = Number(document.querySelector("#centiseconds").value);

  if (!rider || !Number.isInteger(seconds) || !Number.isInteger(centiseconds) || seconds < 0 || centiseconds < 0 || centiseconds > 99) {
    formMessage.textContent = "Vérifie le pseudo et le temps saisi.";
    return;
  }

  const runs = readRuns();
  runs.push({ rider, time: seconds * 100 + centiseconds, recordedAt: new Date().toISOString() });
  saveRuns(runs);
  runForm.reset();
  formMessage.textContent = `Run de ${rider} enregistré en ${formatTime(seconds * 100 + centiseconds)}.`;
  renderRanking();
  document.querySelector("#classement").scrollIntoView({ behavior: "smooth" });
});

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

renderRanking();
