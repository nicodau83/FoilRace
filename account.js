(function setupAccounts() {
  const backend = window.foilRaceBackend;
  const dialog = document.querySelector("#accountDialog");
  const accountButton = document.querySelector("#accountButton");
  const signupEntryButton = document.querySelector("#signupEntryButton");
  const loginEntryButton = document.querySelector("#loginEntryButton");
  const guestEntryActions = document.querySelector("#guestEntryActions");
  const accountTitle = document.querySelector("#accountTitle");
  const closeButton = document.querySelector("#closeAccount");
  const unavailable = document.querySelector("#accountUnavailable");
  const guestAccount = document.querySelector("#guestAccount");
  const memberAccount = document.querySelector("#memberAccount");
  const signupForm = document.querySelector("#signupForm");
  const loginForm = document.querySelector("#loginForm");
  const recoveryForm = document.querySelector("#recoveryForm");
  const signupSuccess = document.querySelector("#signupSuccess");
  const newPasswordForm = document.querySelector("#newPasswordForm");
  const message = document.querySelector("#accountMessage");
  const adminPanel = document.querySelector("#adminPanel");
  const adminRuns = document.querySelector("#adminRuns");
  const adminRiders = document.querySelector("#adminRiders");
  const adminMessage = document.querySelector("#adminMessage");
  const appUrl = "https://nicodau83.github.io/FoilRace/";
  let recoveryMode = false;

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
    message.hidden = !text;
    if (text && dialog.open) dialog.scrollTop = 0;
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
    recoveryMode = false;
    signupSuccess.hidden = true;
    signupForm.hidden = tab !== "signup";
    loginForm.hidden = tab !== "login";
    recoveryForm.hidden = true;
    newPasswordForm.hidden = true;
    accountTitle.textContent = tab === "signup" ? "Créer un compte" : "Se connecter";
    showMessage("");
  }

  function showSignupSuccess(email) {
    recoveryMode = false;
    accountTitle.textContent = "Vérifie tes e-mails";
    signupForm.hidden = true;
    loginForm.hidden = true;
    recoveryForm.hidden = true;
    newPasswordForm.hidden = true;
    signupSuccess.hidden = false;
    document.querySelector("#signupSuccessEmail").textContent = email;
    showMessage("");
  }

  function showRecoveryRequest() {
    recoveryMode = true;
    accountTitle.textContent = "Mot de passe oublié";
    signupSuccess.hidden = true;
    signupForm.hidden = true;
    loginForm.hidden = true;
    recoveryForm.hidden = false;
    newPasswordForm.hidden = true;
    showMessage("");
  }

  function showNewPassword() {
    recoveryMode = true;
    accountTitle.textContent = "Nouveau mot de passe";
    signupSuccess.hidden = true;
    signupForm.hidden = true;
    loginForm.hidden = true;
    recoveryForm.hidden = true;
    newPasswordForm.hidden = false;
    guestAccount.hidden = false;
    memberAccount.hidden = true;
    unavailable.hidden = true;
    if (!dialog.open) dialog.showModal();
    showMessage("Le lien est validé. Choisis maintenant ton nouveau mot de passe.");
  }

  async function refreshAccount() {
    if (!backend?.configured) {
      unavailable.hidden = false;
      guestAccount.hidden = true;
      memberAccount.hidden = true;
      guestEntryActions.hidden = true;
      accountButton.hidden = false;
      accountButton.textContent = "Mon compte";
      publishAuthState();
      if (adminPanel) adminPanel.hidden = true;
      return;
    }
    const { data } = await backend.client.auth.getSession();
    const user = data.session?.user;
    guestEntryActions.hidden = Boolean(user);
    accountButton.hidden = !user;
    guestAccount.hidden = recoveryMode ? false : Boolean(user);
    memberAccount.hidden = recoveryMode ? true : !user;
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
      accountTitle.textContent = "Mon profil";
      publishAuthState(user, profile);
      await loadAdminPanel(user);
    } catch (error) {
      publishAuthState();
      showMessage(error.message || "Profil momentanément indisponible.", true);
    }
  }

  async function openAccount(view) {
    showMessage("");
    await refreshAccount();
    if (!dialog.open) dialog.showModal();
    if (!memberAccount.hidden) {
      accountTitle.textContent = "Mon profil";
      return;
    }
    selectTab(view);
  }

  signupEntryButton.addEventListener("click", () => openAccount("signup"));
  loginEntryButton.addEventListener("click", () => openAccount("login"));
  accountButton.addEventListener("click", () => openAccount("login"));
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.querySelector("#forgotPasswordButton").addEventListener("click", showRecoveryRequest);
  document.querySelector("#backToLoginButton").addEventListener("click", () => selectTab("login"));
  document.querySelector("#signupSuccessLogin").addEventListener("click", () => {
    selectTab("login");
    document.querySelector("#loginEmail").value = document.querySelector("#signupSuccessEmail").textContent;
    showMessage("Valide d’abord le lien reçu par e-mail. Tu pourras ensuite te connecter.");
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pseudo = document.querySelector("#signupPseudo").value.trim();
    const email = document.querySelector("#signupEmail").value.trim();
    const password = document.querySelector("#signupPassword").value;
    const passwordConfirm = document.querySelector("#signupPasswordConfirm").value;
    if (password !== passwordConfirm) {
      showMessage("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    showMessage("Création du compte…");
    try {
      const { data, error } = await backend.client.auth.signUp({
        email,
        password,
        options: {
          data: { pseudo },
          emailRedirectTo: appUrl
        }
      });
      if (error) throw error;
      signupForm.reset();
      if (!data.session) {
        showSignupSuccess(email);
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
      const invalid = /invalid login credentials/i.test(error.message || "");
      showMessage(
        invalid
          ? "Adresse ou mot de passe incorrect. Si ton compte vient d’être créé, confirme d’abord l’e-mail reçu ou utilise « Mot de passe oublié »."
          : (error.message || "Connexion impossible."),
        true
      );
    }
  });

  recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#recoveryEmail").value.trim();
    showMessage("Envoi du lien de réinitialisation…");
    const { error } = await backend.client.auth.resetPasswordForEmail(email, { redirectTo: appUrl });
    if (error) {
      const limited = error.status === 429 || /rate limit|too many/i.test(error.message || "");
      showMessage(
        limited
          ? "Trop de demandes d’e-mail ont été faites. Attends environ une heure avant de réessayer."
          : (error.message || "Impossible d’envoyer le lien."),
        true
      );
      return;
    }
    recoveryForm.reset();
    showMessage("Si un compte correspond à cette adresse, un lien vient d’être envoyé. Vérifie aussi le dossier indésirables.");
  });

  newPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#newPassword").value;
    const passwordConfirm = document.querySelector("#newPasswordConfirm").value;
    if (password !== passwordConfirm) {
      showMessage("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    showMessage("Mise à jour du mot de passe…");
    const { error } = await backend.client.auth.updateUser({ password });
    if (error) {
      showMessage(error.message || "Impossible de modifier le mot de passe.", true);
      return;
    }
    newPasswordForm.reset();
    await backend.client.auth.signOut();
    recoveryMode = false;
    selectTab("login");
    showMessage("Mot de passe modifié. Tu peux maintenant te connecter.");
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

  const authError = new URLSearchParams(window.location.search).get("error_code");
  if (authError === "otp_expired") {
    selectTab("login");
    if (!dialog.open) dialog.showModal();
    showMessage("Ce lien a expiré ou a déjà été utilisé. Saisis ton adresse puis clique sur « Renvoyer l’e-mail de confirmation ».", true);
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (backend?.configured) {
    backend.client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        showNewPassword();
        return;
      }
      setTimeout(refreshAccount, 0);
    });
    refreshAccount();
  } else {
    publishAuthState();
  }
})();
