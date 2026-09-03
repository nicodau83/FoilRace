(function setupAccounts() {
  const backend = window.foilRaceBackend;
  const dialog = document.querySelector("#accountDialog");
  const accountButton = document.querySelector("#accountButton");
  const closeButton = document.querySelector("#closeAccount");
  const unavailable = document.querySelector("#accountUnavailable");
  const guestAccount = document.querySelector("#guestAccount");
  const memberAccount = document.querySelector("#memberAccount");
  const signupForm = document.querySelector("#signupForm");
  const loginForm = document.querySelector("#loginForm");
  const message = document.querySelector("#accountMessage");
  const adminPanel = document.querySelector("#adminPanel");
  const adminRuns = document.querySelector("#adminRuns");
  const adminRiders = document.querySelector("#adminRiders");
  const adminMessage = document.querySelector("#adminMessage");

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  function publishAuthState(user = null, profile = null) {
    window.dispatchEvent(new CustomEvent("foilrace-auth-changed", {
      detail: { user, profile }
    }));
  }

  function formatTime(centiseconds) {
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor((centiseconds % 6000) / 100);
    const hundredths = centiseconds % 100;
    return `${minutes ? `${minutes}:${String(seconds).padStart(2, "0")}` : seconds},${String(hundredths).padStart(2, "0")} s`;
  }

  async function loadAdminPanel(user) {
    if (!adminPanel || !backend?.isAdmin(user)) {
      if (adminPanel) adminPanel.hidden = true;
      return;
    }
    adminPanel.hidden = false;
    adminMessage.textContent = "Chargement…";
    try {
      const data = await backend.getAdminData();
      adminRuns.replaceChildren(...data.runs.map((run) => {
        const row = document.createElement("div");
        row.className = "admin-row";
        const description = document.createElement("span");
        description.textContent = `${run.pseudo} · ${formatTime(run.elapsed_centiseconds)} · ${run.season}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger-button";
        remove.textContent = "Supprimer";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Supprimer le chrono de ${run.pseudo} en ${formatTime(run.elapsed_centiseconds)} ?`)) return;
          adminMessage.textContent = "Suppression du chrono…";
          try {
            await backend.deleteRun(run.id);
            await loadAdminPanel(user);
            window.dispatchEvent(new Event("foilrace-profile-updated"));
          } catch (error) {
            adminMessage.textContent = error.message || "Suppression impossible.";
          }
        });
        row.append(description, remove);
        return row;
      }));

      adminRiders.replaceChildren(...data.profiles.map((profile) => {
        const row = document.createElement("div");
        row.className = "admin-row";
        const description = document.createElement("span");
        description.textContent = profile.id === data.adminUserId ? `${profile.pseudo} · ADMIN` : profile.pseudo;
        row.append(description);
        if (profile.id !== data.adminUserId) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "danger-button";
          remove.textContent = "Supprimer le rider";
          remove.addEventListener("click", async () => {
            if (!window.confirm(`Supprimer définitivement le rider ${profile.pseudo} et tous ses chronos ?`)) return;
            adminMessage.textContent = "Suppression du rider…";
            try {
              await backend.deleteRider(profile);
              await loadAdminPanel(user);
              window.dispatchEvent(new Event("foilrace-profile-updated"));
            } catch (error) {
              adminMessage.textContent = error.message || "Suppression impossible.";
            }
          });
          row.append(remove);
        }
        return row;
      }));

      if (!data.runs.length) adminRuns.textContent = "Aucun chrono enregistré.";
      if (!data.profiles.length) adminRiders.textContent = "Aucun rider.";
      adminMessage.textContent = "";
    } catch (error) {
      adminMessage.textContent = error.message || "Administration indisponible.";
    }
  }

  function selectTab(tab) {
    const signupSelected = tab === "signup";
    signupForm.hidden = !signupSelected;
    loginForm.hidden = signupSelected;
    document.querySelector("#signupTab").classList.toggle("active", signupSelected);
    document.querySelector("#loginTab").classList.toggle("active", !signupSelected);
    document.querySelector("#signupTab").setAttribute("aria-selected", String(signupSelected));
    document.querySelector("#loginTab").setAttribute("aria-selected", String(!signupSelected));
    showMessage("");
  }

  async function refreshAccount() {
    if (!backend?.configured) {
      unavailable.hidden = false;
      guestAccount.hidden = true;
      memberAccount.hidden = true;
      accountButton.textContent = "Mon compte";
      publishAuthState();
      if (adminPanel) adminPanel.hidden = true;
      return;
    }
    const { data } = await backend.client.auth.getSession();
    const user = data.session?.user;
    guestAccount.hidden = Boolean(user);
    memberAccount.hidden = !user;
    unavailable.hidden = true;
    if (!user) {
      accountButton.textContent = "Mon compte";
      publishAuthState();
      if (adminPanel) adminPanel.hidden = true;
      return;
    }
    try {
      const profile = await backend.getProfile(user.id);
      document.querySelector("#profilePseudo").textContent = profile.pseudo;
      document.querySelector("#profileEmail").textContent = user.email || "";
      const avatar = document.querySelector("#profileAvatar");
      if (profile.avatarUrl) {
        const image = document.createElement("img");
        image.src = profile.avatarUrl;
        image.alt = `Photo de ${profile.pseudo}`;
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = profile.pseudo.slice(0, 2).toUpperCase();
      }
      accountButton.textContent = profile.pseudo;
      publishAuthState(user, profile);
      await loadAdminPanel(user);
    } catch (error) {
      publishAuthState();
      showMessage(error.message || "Profil momentanément indisponible.", true);
    }
  }

  accountButton.addEventListener("click", async () => {
    showMessage("");
    await refreshAccount();
    dialog.showModal();
  });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.querySelector("#signupTab").addEventListener("click", () => selectTab("signup"));
  document.querySelector("#loginTab").addEventListener("click", () => selectTab("login"));

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pseudo = document.querySelector("#signupPseudo").value.trim();
    const email = document.querySelector("#signupEmail").value.trim();
    const password = document.querySelector("#signupPassword").value;
    const photo = document.querySelector("#signupPhoto").files[0];
    showMessage("Création du compte…");
    try {
      const { data, error } = await backend.client.auth.signUp({
        email,
        password,
        options: {
          data: { pseudo },
          emailRedirectTo: "https://nicodau83.github.io/FoilRace/"
        }
      });
      if (error) throw error;
      if (data.session && photo) await backend.uploadAvatar(data.user.id, photo);
      signupForm.reset();
      if (!data.session) {
        selectTab("login");
        showMessage("Compte créé. Confirme ton adresse e-mail, puis connecte-toi pour ajouter ta photo.");
      } else {
        await refreshAccount();
        showMessage("Compte créé.");
        window.dispatchEvent(new Event("foilrace-profile-updated"));
      }
    } catch (error) {
      showMessage(error.message || "Impossible de créer le compte.", true);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("Connexion…");
    try {
      const { error } = await backend.client.auth.signInWithPassword({
        email: document.querySelector("#loginEmail").value.trim(),
        password: document.querySelector("#loginPassword").value
      });
      if (error) throw error;
      loginForm.reset();
      await refreshAccount();
      showMessage("Connexion réussie.");
      dialog.close();
    } catch (error) {
      showMessage(error.message || "Connexion impossible.", true);
    }
  });

  document.querySelector("#savePhoto").addEventListener("click", async () => {
    const file = document.querySelector("#profilePhoto").files[0];
    if (!file) return showMessage("Choisis d’abord une photo.", true);
    showMessage("Enregistrement de la photo…");
    try {
      const { data, error } = await backend.client.auth.getUser();
      if (error || !data.user) throw new Error("Reconnecte-toi avant de modifier ta photo.");
      await backend.uploadAvatar(data.user.id, file);
      await refreshAccount();
      showMessage("Photo mise à jour.");
      window.dispatchEvent(new Event("foilrace-profile-updated"));
    } catch (error) {
      showMessage(error.message || "Impossible d’enregistrer la photo.", true);
    }
  });

  document.querySelector("#refreshAdmin")?.addEventListener("click", async () => {
    const { data } = await backend.client.auth.getUser();
    await loadAdminPanel(data.user);
  });

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    await backend.client.auth.signOut();
    await refreshAccount();
    selectTab("login");
    showMessage("Tu es déconnecté.");
  });

  if (backend?.configured) {
    backend.client.auth.onAuthStateChange(() => {
      setTimeout(refreshAccount, 0);
    });
    refreshAccount();
  } else {
    publishAuthState();
  }
})();
