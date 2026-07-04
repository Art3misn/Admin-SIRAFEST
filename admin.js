// =========================================
// FIREBASE IMPORTS
// =========================================
import { db, auth } from "./firebase.js";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    orderBy,
    query,
    getDocs,
    getDoc,
    setDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log('🚀 Premium Admin Dashboard Started...');

/* =========================================
   DOM ELEMENTS
========================================= */
const elements = {
    // Auth
    loginWrapper: document.getElementById("loginWrapper"),
    appWrapper: document.getElementById("appWrapper"),
    loginForm: document.getElementById("loginForm"),
    adminEmail: document.getElementById("adminEmail"),
    adminPassword: document.getElementById("adminPassword"),
    loginError: document.getElementById("loginError"),
    loginBtn: document.getElementById("loginBtn"),

    // Sidebar
    mobileToggle: document.getElementById("mobileToggle"),
    sidebar: document.querySelector(".sidebar"),
    logoutBtn: document.getElementById("logoutBtn"),
    adminName: document.getElementById("adminName"),
    orderBadge: document.getElementById("orderBadge"),

    // Stats
    totalOrders: document.getElementById("totalOrders"),
    pendingOrders: document.getElementById("pendingOrders"),
    completedOrders: document.getElementById("completedOrders"),
    totalRevenue: document.getElementById("totalRevenue"),

    // Ticket
    ticketText: document.getElementById("ticketText"),
    ticketFill: document.getElementById("ticketFill"),
    ticketPercentage: document.getElementById("ticketPercentage"),
    ticketSold: document.getElementById("ticketSold"),
    ticketRemaining: document.getElementById("ticketRemaining"),
    ticketRevenue: document.getElementById("ticketRevenue"),

    // Table
    ordersTable: document.getElementById("ordersTable"),
    ordersFullTable: document.getElementById("ordersFullTable"),
    searchInput: document.getElementById("searchInput"),
    filterStatus: document.getElementById("filterStatus"),
    tableInfo: document.getElementById("tableInfo"),
    pageInfo: document.getElementById("pageInfo"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),

    // Modal
    imageModal: document.getElementById("imageModal"),
    modalImage: document.getElementById("modalImage"),
    closeModal: document.getElementById("closeModal"),

    // Toast
    toastContainer: document.getElementById("toastContainer"),

    // Sounds
    notifSound: document.getElementById("notifSound"),
    successSound: document.getElementById("successSound"),

    // Settings
    totalTicketsInput: document.getElementById("totalTicketsInput"),
    currentTicketsDisplay: document.getElementById("currentTicketsDisplay"),
    priceInput: document.getElementById("priceInput"),
    currentPriceDisplay: document.getElementById("currentPriceDisplay"),
    eventDateInput: document.getElementById("eventDateInput"),
    currentDateDisplay: document.getElementById("currentDateDisplay"),

    // Date
    currentDate: document.getElementById("currentDate"),

    // Buttons
    refreshBtn: document.getElementById("refreshBtn"),
    exportOrdersBtn: document.getElementById("exportOrdersBtn"),
    updateTicketsBtn: document.getElementById("updateTicketsBtn"),
    updatePriceBtn: document.getElementById("updatePriceBtn"),
    updateDateBtn: document.getElementById("updateDateBtn"),
    clearDataBtn: document.getElementById("clearDataBtn"),
    resetSettingsBtn: document.getElementById("resetSettingsBtn"),
};

// Chart instances
let ordersChart = null;
let analyticsChart = null;
let paymentPieChart = null;

/* =========================================
   GLOBAL STATE
========================================= */
let allOrders = [];
let currentPage = 1;
const itemsPerPage = 10;
let filteredOrders = [];
let firstLoad = true;
let totalTickets = 1000;
let ticketPrice = 2500;
let settingsData = {};
let unsubscribe = null;
let isInitialized = false;

/* =========================================
   AUTH STATE
========================================= */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ Admin logged in:', user.email);
        elements.loginWrapper.style.display = "none";
        elements.appWrapper.style.display = "flex";
        if (elements.adminName) {
            elements.adminName.textContent = user.email?.split('@')[0] || 'Admin';
        }
        if (!isInitialized) {
            isInitialized = true;
            initializeDashboard();
        }
    } else {
        console.log('❌ Admin not logged in');
        elements.loginWrapper.style.display = "flex";
        elements.appWrapper.style.display = "none";
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }
});

/* =========================================
   LOGIN HANDLER
========================================= */
elements.loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = elements.adminEmail.value.trim();
    const password = elements.adminPassword.value.trim();

    if (!email || !password) {
        elements.loginError.style.display = "flex";
        elements.loginError.querySelector("span").textContent = "Isi email dan password!";
        return;
    }

    elements.loginBtn.disabled = true;
    elements.loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    elements.loginError.style.display = "none";

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error('Login error:', error);
        let errorMsg = "Email atau password salah!";
        if (error.code === 'auth/user-not-found') errorMsg = "Email tidak terdaftar!";
        else if (error.code === 'auth/wrong-password') errorMsg = "Password salah!";
        else if (error.code === 'auth/invalid-email') errorMsg = "Format email tidak valid!";
        else if (error.code === 'auth/too-many-requests') errorMsg = "Terlalu banyak percobaan! Coba lagi nanti.";
        elements.loginError.style.display = "flex";
        elements.loginError.querySelector("span").textContent = errorMsg;
    } finally {
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Login';
    }
});

/* =========================================
   LOGOUT HANDLER
========================================= */
elements.logoutBtn?.addEventListener('click', async () => {
    if (confirm('Yakin ingin logout?')) {
        try {
            await signOut(auth);
            showToast('👋 Logout berhasil!', 'info');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('❌ Gagal logout', 'error');
        }
    }
});

/* =========================================
   DATE & TIME
========================================= */
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    if (elements.currentDate) {
        elements.currentDate.textContent = now.toLocaleDateString('id-ID', options);
    }
}
updateDateTime();
setInterval(updateDateTime, 60000);

/* =========================================
   TOAST NOTIFICATION
========================================= */
function showToast(message, type = 'success', duration = 4000) {
    const container = elements.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const timeout = setTimeout(() => {
        closeToast(toast);
    }, duration);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timeout);
        closeToast(toast);
    });

    toast.addEventListener('click', () => {
        clearTimeout(timeout);
        closeToast(toast);
    });
}

function closeToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
}

/* =========================================
   IMAGE MODAL
========================================= */
function openModal(src) {
    if (!src) return;
    elements.modalImage.src = src;
    elements.imageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModalFn() {
    elements.imageModal.classList.remove('active');
    document.body.style.overflow = '';
}

elements.closeModal?.addEventListener('click', closeModalFn);
elements.imageModal?.addEventListener('click', (e) => {
    if (e.target === elements.imageModal) closeModalFn();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModalFn();
});

/* =========================================
   SOUNDS
========================================= */
function playNotif() {
    if (elements.notifSound) {
        elements.notifSound.currentTime = 0;
        elements.notifSound.play().catch(() => {});
    }
}

function playSuccess() {
    if (elements.successSound) {
        elements.successSound.currentTime = 0;
        elements.successSound.play().catch(() => {});
    }
}

/* =========================================
   ENSURE SETTINGS DOCUMENT
========================================= */
async function ensureSettingsDocument() {
    try {
        const settingsRef = doc(db, 'settings', 'config');
        const settingsDoc = await getDoc(settingsRef);
        if (!settingsDoc.exists()) {
            await setDoc(settingsRef, {
                totalTickets: 1000,
                ticketPrice: 2500,
                eventDate: "2026-09-05T06:00:00",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log('✅ Settings document created');
            return true;
        }
        return true;
    } catch (error) {
        console.error('❌ Error ensuring settings:', error);
        return false;
    }
}

/* =========================================
   SETTINGS LISTENER (REALTIME)
========================================= */
function setupSettingsListener() {
    console.log('🔄 Setting up settings listener...');

    return onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            totalTickets = data.totalTickets || 1000;
            ticketPrice = data.ticketPrice || 2500;
            settingsData = data;

            // Update UI
            if (elements.totalTicketsInput) elements.totalTicketsInput.value = totalTickets;
            if (elements.currentTicketsDisplay) elements.currentTicketsDisplay.textContent = totalTickets;
            if (elements.priceInput) elements.priceInput.value = ticketPrice;
            if (elements.currentPriceDisplay) elements.currentPriceDisplay.textContent = ticketPrice.toLocaleString('id-ID');

            if (elements.eventDateInput && data.eventDate) {
                elements.eventDateInput.value = data.eventDate;
            }
            if (elements.currentDateDisplay && data.eventDate) {
                const date = new Date(data.eventDate);
                elements.currentDateDisplay.textContent = date.toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }

            if (allOrders.length > 0) {
                updateTicketStats(allOrders);
                updateStats(allOrders);
            }
            
            console.log('✅ Settings loaded:', { totalTickets, ticketPrice });
        } else {
            console.log('📝 Creating default settings...');
            setDoc(doc(db, 'settings', 'config'), {
                totalTickets: 1000,
                ticketPrice: 2500,
                eventDate: "2026-09-05T06:00:00",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }).then(() => {
                console.log('✅ Default settings created');
            }).catch((error) => {
                console.error('❌ Failed to create settings:', error);
            });
        }
    }, (error) => {
        console.error('❌ Settings listener error:', error);
    });
}

/* =========================================
   REALTIME FIRESTORE LISTENER
========================================= */
function setupRealtimeListener() {
    console.log('🔄 Setting up realtime listener...');

    const ordersQuery = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(ordersQuery, (snapshot) => {
        console.log(`📊 Snapshot: ${snapshot.size} documents`);

        allOrders = [];
        snapshot.forEach((docSnap) => {
            allOrders.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        applyFilters();
        updateStats(allOrders);
        updateTicketStats(allOrders);
        updateChart(allOrders);
        updateBadge(allOrders);
        updateAnalytics(allOrders);

        if (!firstLoad) {
            const hasNewData = snapshot.docChanges().some(
                (change) => change.type === "added"
            );
            if (hasNewData) {
                playNotif();
                showToast('📢 New order detected!', 'info');
            }
        }

        firstLoad = false;
    }, (error) => {
        console.error("❌ Firestore Error:", error);
        showToast('❌ Failed to connect to database!', 'error');
    });
}

/* =========================================
   UPDATE TICKET STATS
========================================= */
function updateTicketStats(data) {
    let sold = 0;
    data.forEach(item => {
        sold += Number(item.qty || 0);
    });

    const remaining = totalTickets - sold;
    const percentage = Math.min((sold / totalTickets) * 100, 100);
    const revenue = sold * ticketPrice;

    if (elements.ticketText) elements.ticketText.textContent = `${sold} / ${totalTickets}`;
    if (elements.ticketFill) elements.ticketFill.style.width = percentage + '%';
    if (elements.ticketPercentage) elements.ticketPercentage.textContent = Math.round(percentage) + '%';
    if (elements.ticketSold) elements.ticketSold.textContent = sold;
    if (elements.ticketRemaining) elements.ticketRemaining.textContent = remaining;
    if (elements.ticketRevenue) elements.ticketRevenue.textContent = 'Rp' + revenue.toLocaleString('id-ID');
}

/* =========================================
   UPDATE STATS
========================================= */
function updateStats(data) {
    const total = data.length;
    const pending = data.filter(item => (item.status || "").toLowerCase() === "pending").length;
    const completed = data.filter(item => (item.status || "").toLowerCase() === "done").length;
    const revenue = data.reduce((acc, item) => acc + Number(item.totalPrice || 0), 0);

    animateNumber(elements.totalOrders, total);
    animateNumber(elements.pendingOrders, pending);
    animateNumber(elements.completedOrders, completed);

    if (elements.totalRevenue) {
        elements.totalRevenue.textContent = 'Rp' + revenue.toLocaleString('id-ID');
    }
}

/* =========================================
   ANIMATE NUMBER
========================================= */
function animateNumber(element, target) {
    if (!element) return;
    const current = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(current + (target - current) * eased);
        element.textContent = value;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

/* =========================================
   UPDATE CHART (Dashboard)
========================================= */
function updateChart(data) {
    const ctx = document.getElementById('ordersChart')?.getContext('2d');
    if (!ctx) return;

    const dateMap = {};
    data.forEach(item => {
        if (item.createdAt?.toDate) {
            const date = item.createdAt.toDate();
            const key = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            dateMap[key] = (dateMap[key] || 0) + 1;
        }
    });

    const labels = Object.keys(dateMap).slice(-7);
    const values = labels.map(label => dateMap[label]);

    if (ordersChart) ordersChart.destroy();

    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: values,
                borderColor: '#69d7e8',
                backgroundColor: 'rgba(105, 215, 232, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#69d7e8',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#888' }, grid: { display: false } }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

/* =========================================
   UPDATE ANALYTICS
========================================= */
function updateAnalytics(data) {
    updateAnalyticsChart(data);
    updatePaymentPieChart(data);
    updateDailyStats(data);
}

function updateAnalyticsChart(data) {
    const ctx = document.getElementById('analyticsChart')?.getContext('2d');
    if (!ctx) return;

    const dateMap = {};
    data.forEach(item => {
        if (item.createdAt?.toDate) {
            const date = item.createdAt.toDate();
            const key = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            dateMap[key] = (dateMap[key] || 0) + 1;
        }
    });

    const labels = Object.keys(dateMap).slice(-14);
    const values = labels.map(label => dateMap[label]);

    if (analyticsChart) analyticsChart.destroy();

    analyticsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: values,
                backgroundColor: 'rgba(105, 215, 232, 0.6)',
                borderColor: '#69d7e8',
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#888' }, grid: { display: false } }
            }
        }
    });
}

function updatePaymentPieChart(data) {
    const ctx = document.getElementById('paymentPieChart')?.getContext('2d');
    if (!ctx) return;

    const cod = data.filter(item => (item.paymentMethod || '').toUpperCase() === 'COD').length;
    const qris = data.filter(item => (item.paymentMethod || '').toUpperCase() === 'QRIS').length;
    const others = data.length - cod - qris;

    if (paymentPieChart) paymentPieChart.destroy();

    paymentPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['COD', 'QRIS', 'Others'],
            datasets: [{
                data: [cod, qris, others],
                backgroundColor: ['#f3d36c', '#69d7e8', '#888'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e0e0e0',
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function updateDailyStats(data) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let todayCount = 0,
        weekCount = 0,
        monthCount = 0;
    data.forEach(item => {
        const date = item.createdAt?.toDate?.();
        if (date) {
            if (date >= today) todayCount++;
            if (date >= weekAgo) weekCount++;
            if (date >= monthAgo) monthCount++;
        }
    });

    if (elements.todayOrders) elements.todayOrders.textContent = todayCount;
    if (elements.weekOrders) elements.weekOrders.textContent = weekCount;
    if (elements.monthOrders) elements.monthOrders.textContent = monthCount;
}

function updateBadge(data) {
    const pending = data.filter(item => (item.status || "").toLowerCase() === "pending").length;
    if (elements.orderBadge) {
        elements.orderBadge.textContent = pending;
        elements.orderBadge.style.display = pending > 0 ? 'inline-block' : 'none';
    }
}

/* =========================================
   APPLY FILTERS
========================================= */
function applyFilters() {
    const searchTerm = elements.searchInput?.value?.toLowerCase() || '';
    const statusFilter = elements.filterStatus?.value || 'all';

    filteredOrders = allOrders.filter(item => {
        const matchSearch =
            (item.name || '').toLowerCase().includes(searchTerm) ||
            (item.phone || '').toLowerCase().includes(searchTerm) ||
            (item.address || '').toLowerCase().includes(searchTerm);

        const matchStatus = statusFilter === 'all' ||
            (item.status || '').toLowerCase() === statusFilter;

        return matchSearch && matchStatus;
    });

    currentPage = 1;
    renderTable(filteredOrders);
}

/* =========================================
   RENDER TABLE
========================================= */
function renderTable(dataList) {
    if (!elements.ordersTable) return;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = dataList.slice(start, end);

    if (dataList.length === 0) {
        elements.ordersTable.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <span>No orders yet</span>
                </td>
            </tr>
        `;
        updatePagination(dataList.length);
        renderFullTable(dataList);
        return;
    }

    let html = '';
    pageData.forEach((data, index) => {
        const status = data.status || 'pending';
        const statusLower = status.toLowerCase();
        const date = data.createdAt?.toDate?.() || new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const statusColors = {
            pending: { bg: 'rgba(255,152,0,0.15)', color: '#ff9800' },
            processed: { bg: 'rgba(105,215,232,0.15)', color: '#69d7e8' },
            done: { bg: 'rgba(76,175,80,0.15)', color: '#4CAF50' }
        };
        const statusStyle = statusColors[statusLower] || statusColors.pending;

        html += `
            <tr>
                <td>${start + index + 1}</td>
                <td><strong>${data.name || '-'}</strong></td>
                <td>
                    <a href="https://wa.me/${formatWhatsApp(data.phone || '')}" 
                       target="_blank" class="wa-link">
                        <i class="fa-brands fa-whatsapp"></i> ${data.phone || '-'}
                    </a>
                </td>
                <td>${data.address || '-'}</td>
                <td><strong>${data.qty || 0}</strong></td>
                <td>${data.paymentMethod || 'COD'}</td>
                <td>Rp${(data.totalPrice || 0).toLocaleString('id-ID')}</td>
                <td>
                    ${data.buktiTransfer ? `
                        <button class="view-btn" data-image="${data.buktiTransfer}">
                            <i class="fa-solid fa-image"></i>
                        </button>
                    ` : '<span class="no-proof">-</span>'}
                </td>
                <td>
                    <span class="status-badge ${statusLower}" style="background:${statusStyle.bg};color:${statusStyle.color}">
                        <span class="status-dot" style="background:${statusStyle.color}"></span>
                        ${status}
                    </span>
                </td>
                <td>${formattedDate}</td>
                <td>
                    <div class="action-group">
                        ${statusLower !== 'done' ? `
                            <button class="action-btn process" data-id="${data.id}" data-status="processed">
                                <i class="fa-solid fa-spinner"></i>
                            </button>
                            <button class="action-btn done" data-id="${data.id}" data-status="done">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        ` : `
                            <button class="action-btn completed" disabled>
                                <i class="fa-solid fa-check-circle"></i>
                            </button>
                        `}
                        <button class="action-btn delete" data-id="${data.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.ordersTable.innerHTML = html;
    updatePagination(dataList.length);
    setupButtons();
    renderFullTable(dataList);
}

function renderFullTable(dataList) {
    if (!elements.ordersFullTable) return;

    if (dataList.length === 0) {
        elements.ordersFullTable.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <span>No orders yet</span>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    dataList.forEach((data, index) => {
        const status = data.status || 'pending';
        const statusLower = status.toLowerCase();
        const date = data.createdAt?.toDate?.() || new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${data.name || '-'}</strong></td>
                <td>${data.phone || '-'}</td>
                <td>${data.qty || 0}</td>
                <td>${data.paymentMethod || 'COD'}</td>
                <td>Rp${(data.totalPrice || 0).toLocaleString('id-ID')}</td>
                <td>
                    <span class="status-badge ${statusLower}">
                        <span class="status-dot"></span>
                        ${status}
                    </span>
                </td>
                <td>${formattedDate}</td>
            </tr>
        `;
    });

    elements.ordersFullTable.innerHTML = html;
}

/* =========================================
   UPDATE PAGINATION
========================================= */
function updatePagination(total) {
    const totalPages = Math.ceil(total / itemsPerPage) || 1;

    if (elements.tableInfo) {
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(start + itemsPerPage - 1, total);
        elements.tableInfo.textContent = total > 0 ?
            `Showing ${start}-${end} of ${total} entries` :
            'Showing 0 entries';
    }

    if (elements.pageInfo) {
        elements.pageInfo.textContent = `${currentPage} / ${totalPages}`;
    }

    if (elements.prevPage) {
        elements.prevPage.disabled = currentPage === 1;
    }
    if (elements.nextPage) {
        elements.nextPage.disabled = currentPage === totalPages;
    }
}

/* =========================================
   FORMAT WHATSAPP
========================================= */
function formatWhatsApp(number) {
    if (!number) return '';
    let cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }
    return cleaned;
}

/* =========================================
   SETUP BUTTONS
========================================= */
function setupButtons() {
    document.querySelectorAll('.action-btn.process, .action-btn.done').forEach((btn) => {
        btn.onclick = async function() {
            const id = this.dataset.id;
            const status = this.dataset.status;
            if (!id || !status) return;

            this.disabled = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                await updateDoc(doc(db, "orders", id), {
                    status: status,
                    updatedAt: serverTimestamp()
                });
                playSuccess();
                showToast(`✅ Order updated to "${status}"!`, 'success');
            } catch (error) {
                console.error('Update error:', error);
                showToast('❌ Failed to update order', 'error');
                this.disabled = false;
                this.innerHTML = status === 'processed' ?
                    '<i class="fa-solid fa-spinner"></i>' :
                    '<i class="fa-solid fa-check"></i>';
            }
        };
    });

    document.querySelectorAll('.action-btn.delete').forEach((btn) => {
        btn.onclick = async function() {
            const id = this.dataset.id;
            if (!id) return;

            if (!confirm('⚠️ Are you sure you want to delete this order?')) return;

            this.disabled = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                await deleteDoc(doc(db, "orders", id));
                showToast('🗑️ Order deleted!', 'warning');
            } catch (error) {
                console.error('Delete error:', error);
                showToast('❌ Failed to delete order', 'error');
                this.disabled = false;
                this.innerHTML = '<i class="fa-solid fa-trash"></i>';
            }
        };
    });

    document.querySelectorAll('.view-btn').forEach((btn) => {
        btn.onclick = function() {
            const image = this.dataset.image;
            if (image) openModal(image);
        };
    });
}

/* =========================================
   SEARCH & FILTER
========================================= */
elements.searchInput?.addEventListener('input', applyFilters);
elements.filterStatus?.addEventListener('change', applyFilters);

/* =========================================
   PAGINATION
========================================= */
elements.prevPage?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable(filteredOrders);
    }
});

elements.nextPage?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable(filteredOrders);
    }
});

/* =========================================
   REFRESH
========================================= */
elements.refreshBtn?.addEventListener('click', function() {
    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    if (unsubscribe) unsubscribe();
    unsubscribe = setupRealtimeListener();

    setTimeout(() => {
        this.disabled = false;
        this.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
        showToast('✅ Data refreshed!', 'success');
    }, 1000);
});

/* =========================================
   EXPORT CSV
========================================= */
elements.exportOrdersBtn?.addEventListener('click', function() {
    if (!allOrders || allOrders.length === 0) {
        showToast('⚠️ No data to export!', 'warning');
        return;
    }

    try {
        let csv = 'No,Customer,WhatsApp,Address,Qty,Payment,Total,Status,Created At\n';
        allOrders.forEach((data, index) => {
            const date = data.createdAt?.toDate?.() || new Date();
            csv += `${index + 1},`;
            csv += `"${data.name || '-'}",`;
            csv += `"${data.phone || '-'}",`;
            csv += `"${data.address || '-'}",`;
            csv += `${data.qty || 0},`;
            csv += `"${data.paymentMethod || 'COD'}",`;
            csv += `${data.totalPrice || 0},`;
            csv += `"${data.status || 'pending'}",`;
            csv += `"${date.toLocaleDateString('id-ID')}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        showToast('✅ CSV exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('❌ Failed to export CSV', 'error');
    }
});

/* =========================================
   SIDEBAR NAVIGATION
========================================= */
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');

        const page = this.dataset.page;
        showPage(page);
    });
});

function showPage(page) {
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });

    const targetPage = document.getElementById(`page${page.charAt(0).toUpperCase() + page.slice(1)}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Overview orders & statistics' },
        orders: { title: 'Orders', subtitle: 'Manage all customer orders' },
        analytics: { title: 'Analytics', subtitle: 'Tournament statistics & insights' },
        settings: { title: 'Settings', subtitle: 'System configuration' }
    };

    const info = titles[page] || titles.dashboard;
    document.getElementById('pageTitle').textContent = info.title;
    document.getElementById('pageSubtitle').textContent = info.subtitle;
}

/* =========================================
   MOBILE TOGGLE
========================================= */
elements.mobileToggle?.addEventListener('click', function() {
    elements.sidebar.classList.toggle('active');
});

/* =========================================
   SETTINGS FUNCTIONS
========================================= */

// Update Tickets
elements.updateTicketsBtn?.addEventListener('click', async function() {
    const newValue = parseInt(elements.totalTicketsInput?.value);
    if (!newValue || newValue < 1) {
        showToast('⚠️ Please enter a valid number (min 1)', 'warning');
        return;
    }

    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        await ensureSettingsDocument();
        
        const settingsRef = doc(db, 'settings', 'config');
        await updateDoc(settingsRef, {
            totalTickets: newValue,
            updatedAt: serverTimestamp()
        });
        
        totalTickets = newValue;
        if (elements.currentTicketsDisplay) {
            elements.currentTicketsDisplay.textContent = newValue;
        }
        showToast(`✅ Total tickets updated to ${newValue}`, 'success');
        updateTicketStats(allOrders);
    } catch (error) {
        console.error('Update tickets error:', error);
        showToast(`❌ Failed to update tickets: ${error.message}`, 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = 'Update';
    }
});

// Update Price
elements.updatePriceBtn?.addEventListener('click', async function() {
    const newValue = parseInt(elements.priceInput?.value);
    if (!newValue || newValue < 0) {
        showToast('⚠️ Please enter a valid price (min 0)', 'warning');
        return;
    }

    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        await ensureSettingsDocument();
        
        const settingsRef = doc(db, 'settings', 'config');
        await updateDoc(settingsRef, {
            ticketPrice: newValue,
            updatedAt: serverTimestamp()
        });
        
        ticketPrice = newValue;
        if (elements.currentPriceDisplay) {
            elements.currentPriceDisplay.textContent = newValue.toLocaleString('id-ID');
        }
        showToast(`✅ Price updated to Rp${newValue.toLocaleString('id-ID')}`, 'success');
        updateTicketStats(allOrders);
        updateStats(allOrders);
    } catch (error) {
        console.error('Update price error:', error);
        showToast(`❌ Failed to update price: ${error.message}`, 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = 'Update';
    }
});

// Update Event Date
elements.updateDateBtn?.addEventListener('click', async function() {
    const newValue = elements.eventDateInput?.value;
    if (!newValue) {
        showToast('⚠️ Please select a date', 'warning');
        return;
    }

    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        await ensureSettingsDocument();
        
        const settingsRef = doc(db, 'settings', 'config');
        await updateDoc(settingsRef, {
            eventDate: newValue,
            updatedAt: serverTimestamp()
        });
        
        const date = new Date(newValue);
        if (elements.currentDateDisplay) {
            elements.currentDateDisplay.textContent = date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        showToast('✅ Event date updated!', 'success');
    } catch (error) {
        console.error('Update date error:', error);
        showToast(`❌ Failed to update date: ${error.message}`, 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = 'Update';
    }
});

// Reset Settings
elements.resetSettingsBtn?.addEventListener('click', async function() {
    if (!confirm('⚠️ Reset all settings to default?')) return;

    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

    try {
        const settingsRef = doc(db, 'settings', 'config');
        await setDoc(settingsRef, {
            totalTickets: 1000,
            ticketPrice: 2500,
            eventDate: "2026-09-05T06:00:00",
            updatedAt: serverTimestamp()
        });
        
        totalTickets = 1000;
        ticketPrice = 2500;
        
        if (elements.totalTicketsInput) elements.totalTicketsInput.value = 1000;
        if (elements.currentTicketsDisplay) elements.currentTicketsDisplay.textContent = 1000;
        if (elements.priceInput) elements.priceInput.value = 2500;
        if (elements.currentPriceDisplay) elements.currentPriceDisplay.textContent = '2.500';
        
        const defaultDate = new Date("2026-09-05T06:00:00");
        if (elements.currentDateDisplay) {
            elements.currentDateDisplay.textContent = defaultDate.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        
        showToast('✅ Settings reset to default!', 'success');
        updateTicketStats(allOrders);
        updateStats(allOrders);
    } catch (error) {
        console.error('Reset settings error:', error);
        showToast(`❌ Failed to reset settings: ${error.message}`, 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = '<i class="fa-solid fa-rotate"></i> Reset Settings';
    }
});

// Clear Data
elements.clearDataBtn?.addEventListener('click', async function() {
    if (!confirm('⚠️ ARE YOU SURE? This will delete ALL order data!\n\nThis action cannot be undone!')) return;
    if (!confirm('⚠️ SECOND CONFIRMATION: Delete all data?')) return;

    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

    try {
        const snapshot = await getDocs(collection(db, 'orders'));
        if (snapshot.empty) {
            showToast('ℹ️ No data to delete', 'info');
            this.disabled = false;
            this.innerHTML = '<i class="fa-solid fa-trash"></i> Clear All Data';
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showToast('🗑️ All data cleared successfully!', 'warning');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Clear data error:', error);
        showToast(`❌ Failed to clear data: ${error.message}`, 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = '<i class="fa-solid fa-trash"></i> Clear All Data';
    }
});

/* =========================================
   INITIALIZE DASHBOARD
========================================= */
function initializeDashboard() {
    console.log('🚀 Initializing dashboard...');

    setupSettingsListener();
    if (unsubscribe) unsubscribe();
    unsubscribe = setupRealtimeListener();

    console.log('✅ Premium Admin Dashboard ready!');
}

console.log('🚀 Admin Dashboard script loaded!');
