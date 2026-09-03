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

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
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
      return;
    }
    const { data } = await backend.client.auth.getSession();
    const user = data.session?.user;
    guestAccount.hidden = Boolean(user);
    memberAccount.hidden = !user;
    unavailable.hidden = true;
    if (!user) {
      accountButton.textContent = "Mon compte";
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
    } catch (error) {
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
        options: { data: { pseudo } }
      });
      if (error) throw error;
      if (data.session && photo) await backend.uploadAvatar(data.user.id, photo);
      signupForm.reset();
      if (!data.session) {
        showMessage("Compte créé. Confirme ton adresse e-mail, puis connecte-toi pour ajouter ta photo.");
        selectTab("login");
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
    const { error } = await backend.client.auth.signInWithPassword({
      email: document.querySelector("#loginEmail").value.trim(),
      password: document.querySelector("#loginPassword").value
    });
    if (error) return showMessage(error.message, true);
    loginForm.reset();
    await refreshAccount();
    showMessage("Connexion réussie.");
  });

  document.querySelector("#savePhoto").addEventListener("click", async () => {
    const file = document.querySelector("#profilePhoto").files[0];
    if (!file) return showMessage("Choisis d’abord une photo.", true);
    showMessage("Enregistrement de la photo…");
    try {
      const { data } = await backend.client.auth.getUser();
      await backend.uploadAvatar(data.user.id, file);
      await refreshAccount();
      showMessage("Photo mise à jour.");
      window.dispatchEvent(new Event("foilrace-profile-updated"));
    } catch (error) {
      showMessage(error.message || "Impossible d’enregistrer la photo.", true);
    }
  });

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    await backend.client.auth.signOut();
    await refreshAccount();
    selectTab("login");
    showMessage("Tu es déconnecté.");
  });

  if (backend?.configured) {
    backend.client.auth.onAuthStateChange(() => refreshAccount());
    refreshAccount();
  }
})();
