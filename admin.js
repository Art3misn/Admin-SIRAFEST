import { db } from "./firebase.js";

import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================
   ELEMENT
========================================= */

const table = document.getElementById("orderTable");

const notifSound = document.getElementById("notifSound");
const successSound = document.getElementById("successSound");

const searchInput = document.getElementById("search");
const filterStatus = document.getElementById("filterStatus");

const previewModal = document.getElementById("previewModal");
const previewImage = document.getElementById("previewImage");
const closePreview = document.getElementById("closePreview");

/* =========================================
   DATA
========================================= */

let allData = [];
let initialized = false;

/* =========================================
   FORMAT
========================================= */

function rupiah(number) {
  return Number(number || 0).toLocaleString("id-ID");
}

function escapeHtml(text) {
  if (!text) return "-";

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/* =========================================
   SOUND
========================================= */

function playNotif() {
  if (!notifSound) return;
  notifSound.currentTime = 0;
  notifSound.play().catch(() => {});
}

function playSuccess() {
  if (!successSound) return;
  successSound.currentTime = 0;
  successSound.play().catch(() => {});
}

/* =========================================
   STATUS BADGE
========================================= */

function getBadgeClass(status) {
  switch (status) {
    case "processed":
      return "cod";
    case "done":
      return "success";
    default:
      return "pending";
  }
}

function getStatusText(status) {
  switch (status) {
    case "processed":
      return "Diproses";
    case "done":
      return "Selesai";
    default:
      return "Pending";
  }
}

/* =========================================
   AUTH (FRONT-END SEDERHANA)
========================================= */

const AUTH_STORAGE_KEY = "admin_auth_v1";

// Default kredensial hanya dipakai sekali untuk sesi pertama.
// Setelah login sukses, username/password disimpan sebagai bagian auth state.
const DEFAULT_USERNAME = "adminrw04";
const DEFAULT_PASSWORD = "karangtaruna04";


function getAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return {
        username: DEFAULT_USERNAME,
        password: DEFAULT_PASSWORD,
        loggedIn: false,
      };
    }

    const parsed = JSON.parse(raw) || {};

    return {
      username: parsed.username || DEFAULT_USERNAME,
      password: parsed.password || DEFAULT_PASSWORD,
      loggedIn: Boolean(parsed.loggedIn),
    };
  } catch {
    return {
      username: DEFAULT_USERNAME,
      password: DEFAULT_PASSWORD,
      loggedIn: false,
    };
  }
}

function setAuthState(next) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
}

function isLoggedIn() {
  return getAuthState().loggedIn;
}

window.logoutAdmin = function () {
  const state = getAuthState();

  setAuthState({
    ...state,
    loggedIn: false,
  });

  setUiAuthMode("login");

  const orderTable = document.getElementById("orderTable");
  if (orderTable) orderTable.innerHTML = "";
};


function login(username, password) {
  const state = getAuthState();

  const ok =
    String(username || "") === state.username &&
    String(password || "") === state.password;

  if (!ok) return false;

  setAuthState({
    ...state,
    loggedIn: true,
  });

  return true;
}

function updateCredential(newUsername, newPassword) {
  const state = getAuthState();

  const u = String(newUsername || "").trim();
  const p = String(newPassword || "");

  if (u.length < 3) return { ok: false, message: "Username terlalu pendek" };
  if (p.length < 3) return { ok: false, message: "Password terlalu pendek" };

  setAuthState({
    ...state,
    username: u,
    password: p,
    loggedIn: true,
  });

  return { ok: true };
}

function setUiAuthMode(mode) {
  const authWrapper = document.getElementById("authWrapper");
  const app = document.getElementById("app");

  if (!authWrapper || !app) return;

  const showLogin = mode === "login";
  authWrapper.style.display = showLogin ? "flex" : "none";
  app.style.display = showLogin ? "none" : "flex";
}

function initAuthUI() {
  const loginBtn = document.getElementById("loginBtn");
  const resetCredentialBtn = document.getElementById("resetCredentialBtn");
  const saveCredentialBtn = document.getElementById("saveCredentialBtn");
  const loginError = document.getElementById("loginError");

  const adminUsername = document.getElementById("adminUsername");
  const adminPassword = document.getElementById("adminPassword");

  const newAdminUsername = document.getElementById("newAdminUsername");
  const newAdminPassword = document.getElementById("newAdminPassword");

  if (!loginBtn) return;

  const state = getAuthState();
  if (adminUsername && !adminUsername.value) adminUsername.value = state.username;

  loginBtn.addEventListener("click", () => {
    if (loginError) {
      loginError.style.display = "none";
      loginError.textContent = "";
    }

    const ok = login(adminUsername?.value, adminPassword?.value);

    if (!ok) {
      if (loginError) {
        loginError.textContent = "Username / password salah";
        loginError.style.display = "block";
      }
      return;
    }

    setUiAuthMode("app");
    location.reload();
  });

  if (saveCredentialBtn) {
    saveCredentialBtn.addEventListener("click", () => {
      const result = updateCredential(newAdminUsername?.value, newAdminPassword?.value);
      if (!result.ok) {
        if (loginError) {
          loginError.textContent = result.message;
          loginError.style.display = "block";
        }
        return;
      }

      if (newAdminUsername) newAdminUsername.value = "";
      if (newAdminPassword) newAdminPassword.value = "";

      location.reload();
    });
  }

  if (resetCredentialBtn) {
    resetCredentialBtn.addEventListener("click", () => {
      setAuthState({
        ...getAuthState(),
        username: DEFAULT_USERNAME,
        password: DEFAULT_PASSWORD,
        loggedIn: true,
      });

      if (adminUsername) adminUsername.value = DEFAULT_USERNAME;
      if (adminPassword) adminPassword.value = "";
      if (newAdminUsername) newAdminUsername.value = "";
      if (newAdminPassword) newAdminPassword.value = "";

      location.reload();
    });
  }
}

/* =========================================
   INIT AUTH + FIREBASE (HANYA SAAT LOGIN)
========================================= */

initAuthUI();

if (isLoggedIn()) {
  setUiAuthMode("app");

  onSnapshot(collection(db, "orders"), (snapshot) => {
    const newData = [];

    snapshot.forEach((docSnap) => {
      newData.push({ id: docSnap.id, ...docSnap.data() });
    });

    newData.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

    if (initialized && newData.length > allData.length) playNotif();

    initialized = true;
    allData = newData;

    filterData();
    updateStats(newData);
  });
} else {
  setUiAuthMode("login");
}

/* =========================================
   RENDER TABLE
========================================= */

function render(data) {
  if (!table) return;

  if (!data.length) {
    table.innerHTML = `
      <tr>
        <td colspan="11" class="empty-table">Tidak ada order</td>
      </tr>
    `;
    return;
  }

  let html = "";

  data.forEach((item) => {
    const status = item.status || "pending";
    const badgeClass = getBadgeClass(status);

    const date = item.createdAt?.seconds
      ? new Date(item.createdAt.seconds * 1000).toLocaleString("id-ID")
      : "-";

    const buktiImage = item.buktiTransfer
      ? `
        <img
          src="${item.buktiTransfer}"
          class="proof-image"
          onclick="previewProof('${item.buktiTransfer}')"
        >
      `
      : "-";

    html += `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.phone)}</td>
        <td>${escapeHtml(item.city)}</td>
        <td>${escapeHtml(item.address)}</td>
        <td>${item.qty || 0}</td>
        <td>${escapeHtml(item.paymentMethod)}</td>
        <td>Rp${rupiah(item.totalPrice)}</td>
        <td>${buktiImage}</td>
        <td><span class="badge ${badgeClass}">${getStatusText(status)}</span></td>
        <td>${date}</td>
        <td>
          <div class="action-group">
            <button class="action-btn wa-btn" onclick="wa('${item.phone}')">WA</button>
            <button class="action-btn done-btn" onclick="processOrder('${item.id}','processed')">Proses</button>
            <button class="action-btn done-btn" onclick="processOrder('${item.id}','done')">Selesai</button>
            <button class="action-btn delete-btn" onclick="removeOrder('${item.id}')">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  });

  table.innerHTML = html;
}

/* =========================================
   UPDATE STATS
========================================= */

function updateStats(data) {
  const totalOrders = document.getElementById("totalOrders");
  const pendingOrders = document.getElementById("pendingOrders");
  const completedOrders = document.getElementById("completedOrders");
  const totalRevenue = document.getElementById("totalRevenue");

  const pending = data.filter((d) => d.status === "pending").length;
  const done = data.filter((d) => d.status === "done").length;

  const revenue = data.reduce(
    (acc, item) => acc + Number(item.totalPrice || 0),
    0
  );

  if (totalOrders) totalOrders.innerText = data.length;
  if (pendingOrders) pendingOrders.innerText = pending;
  if (completedOrders) completedOrders.innerText = done;
  if (totalRevenue) totalRevenue.innerText = `Rp${rupiah(revenue)}`;
}

/* =========================================
   FILTER DATA
========================================= */

function filterData() {
  let filtered = [...allData];

  const keyword = searchInput?.value?.toLowerCase()?.trim() || "";
  const status = filterStatus?.value || "";

  if (keyword) {
    filtered = filtered.filter(
      (item) =>
        item.name?.toLowerCase()?.includes(keyword) ||
        item.phone?.toLowerCase()?.includes(keyword) ||
        item.address?.toLowerCase()?.includes(keyword)
    );
  }

  if (status) filtered = filtered.filter((item) => item.status === status);

  render(filtered);
}

/* =========================================
   SEARCH EVENT
========================================= */

if (searchInput) {
  let timeout;

  searchInput.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(filterData, 250);
  });
}

/* =========================================
   FILTER STATUS
========================================= */

if (filterStatus) {
  filterStatus.addEventListener("change", filterData);
}

/* =========================================
   UPDATE STATUS
========================================= */

window.processOrder = async function (id, status) {
  if (!isLoggedIn()) {
    alert("Login admin dulu.");
    return;
  }

  try {
    await updateDoc(doc(db, "orders", id), { status });
    playSuccess();
  } catch (error) {
    console.error(error);
    alert("Gagal update status!");
  }
};

/* =========================================
   DELETE ORDER
========================================= */

window.removeOrder = async function (id) {
  if (!isLoggedIn()) {
    alert("Login admin dulu.");
    return;
  }

  const confirmDelete = confirm("Hapus order ini?");
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "orders", id));
  } catch (error) {
    console.error(error);
    alert("Gagal hapus order!");
  }
};

/* =========================================
   WHATSAPP
========================================= */

window.wa = function (phone) {
  if (!phone) return;

  const fixPhone = String(phone).replace(/\D/g, "").replace(/^0/, "62");
  window.open(`https://wa.me/${fixPhone}`, "_blank");
};

/* =========================================
   PREVIEW IMAGE
========================================= */

window.previewProof = function (src) {
  if (!previewModal || !previewImage) return;

  previewModal.style.display = "flex";
  previewImage.src = src;
};

function closeModal() {
  if (!previewModal) return;
  previewModal.style.display = "none";
}

if (closePreview) {
  closePreview.addEventListener("click", closeModal);
}

if (previewModal) {
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closeModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

