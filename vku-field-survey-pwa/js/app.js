const DB_NAME = "vku-library-survey-db";
const DB_VERSION = 1;
const STORE_NAME = "surveys";
const ENDPOINT_KEY = "vku-library-sheet-endpoint";

const $ = (selector) => document.querySelector(selector);
const form = $("#survey-form");
const networkStatus = $("#network-status");
const totalCount = $("#total-count");
const pendingCount = $("#pending-count");
const historyList = $("#history-list");
const toast = $("#toast");
const endpointInput = $("#sheet-endpoint");
const photoInput = $("#photo");
const photoPreview = $("#photo-preview");
const locationStatus = $("#location-status");
let db;
let photoDataUrl = "";

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("syncStatus", "syncStatus", { unique: false });
            store.createIndex("createdAt", "createdAt", { unique: false });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transaction(mode = "readonly") {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function saveRecord(record) {
    return new Promise((resolve, reject) => {
        const request = transaction("readwrite").put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

function getAllRecords() {
    return new Promise((resolve, reject) => {
        const request = transaction().getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        request.onerror = () => reject(request.error);
    });
}

function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "medium"
    }).format(date);
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3800);
}

async function notify(message) {
    showToast(message);

    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
        await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
        new Notification("VKU Library Survey", {
            body: message,
            tag: "vku-library-survey-sync"
        });
    }
}

function updateNetworkStatus() {
    if (navigator.onLine) {
        networkStatus.textContent = "Online";
        networkStatus.classList.remove("offline");
        syncPendingRecords();
    } else {
        networkStatus.textContent = "Offline";
        networkStatus.classList.add("offline");
    }
}

function updateRangeOutputs() {
    document.querySelectorAll('input[type="range"]').forEach((input) => {
        const output = document.querySelector(`[data-output="${input.name}"]`);
        if (output) output.textContent = `${input.value}/5`;
        input.addEventListener("input", () => {
            if (output) output.textContent = `${input.value}/5`;
        });
    });
}

function readFormData() {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
}

function makeRecord() {
    const values = readFormData();
    const now = new Date();

    return {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        createdAtText: formatTime(now),
        syncStatus: "pending",
        syncedAt: "",
        photoDataUrl,
        photoIncluded: Boolean(photoDataUrl),
        ...values
    };
}

async function resizeImage(file) {
    if (!file) return "";

    const bitmap = await createImageBitmap(file);
    const maxSize = 900;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
}

async function handlePhotoChange() {
    const file = photoInput.files[0];
    photoDataUrl = await resizeImage(file);

    if (photoDataUrl) {
        photoPreview.src = photoDataUrl;
        photoPreview.classList.remove("hidden");
    } else {
        photoPreview.removeAttribute("src");
        photoPreview.classList.add("hidden");
    }
}

function getLocation() {
    if (!navigator.geolocation) {
        locationStatus.textContent = "Thiết bị không hỗ trợ GPS";
        return;
    }

    locationStatus.textContent = "Đang lấy vị trí...";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            $("#latitude").value = latitude.toFixed(6);
            $("#longitude").value = longitude.toFixed(6);
            $("#locationAccuracy").value = Math.round(accuracy);
            locationStatus.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} ±${Math.round(accuracy)}m`;
            showToast("Đã lấy vị trí hiện trường.");
        },
        () => {
            locationStatus.textContent = "Không lấy được vị trí. Hãy bật quyền Location.";
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 60000
        }
    );
}

function getEndpoint() {
    return localStorage.getItem(ENDPOINT_KEY) || "";
}

function buildSheetPayload(record) {
    return {
        id: record.id,
        createdAt: record.createdAt,
        interviewer: record.interviewer,
        interviewee: record.interviewee,
        sessionType: record.sessionType,
        major: record.major,
        schoolYear: record.schoolYear,
        gender: record.gender,
        age: record.age,
        awareness: record.awareness,
        visitFrequency: record.visitFrequency,
        studySpace: record.studySpace,
        materials: record.materials,
        wifiEquipment: record.wifiEquipment,
        staffSupport: record.staffSupport,
        openingHours: record.openingHours,
        overallSatisfaction: record.overallSatisfaction,
        suggestion: record.suggestion,
        notes: record.notes,
        latitude: record.latitude,
        longitude: record.longitude,
        locationAccuracy: record.locationAccuracy,
        photoIncluded: record.photoIncluded ? "Yes" : "No",
        photoDataUrl: record.photoDataUrl
    };
}

async function sendToSheet(record) {
    const endpoint = getEndpoint();
    if (!endpoint) throw new Error("Missing Google Sheet endpoint");

    await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(buildSheetPayload(record))
    });
}

async function syncPendingRecords() {
    if (!db || !navigator.onLine || !getEndpoint()) {
        await refreshHistory();
        return;
    }

    const records = await getAllRecords();
    const pending = records.filter((record) => record.syncStatus !== "synced");
    let syncedCount = 0;

    for (const record of pending) {
        try {
            await sendToSheet(record);
            record.syncStatus = "synced";
            record.syncedAt = new Date().toISOString();
            await saveRecord(record);
            syncedCount += 1;
        } catch (error) {
            console.warn("Sync failed", error);
            break;
        }
    }

    await refreshHistory();

    if (syncedCount > 0) {
        await notify(`Đã đồng bộ ${syncedCount} phiếu lên Google Sheet.`);
    }
}

async function refreshHistory() {
    const records = await getAllRecords();
    totalCount.textContent = records.length;
    pendingCount.textContent = records.filter((record) => record.syncStatus !== "synced").length;

    if (records.length === 0) {
        historyList.innerHTML = '<article><p>Chưa có phiên phỏng vấn nào được lưu.</p></article>';
        return;
    }

    historyList.innerHTML = records.map((record) => {
        const location = record.latitude && record.longitude
            ? `${record.latitude}, ${record.longitude}`
            : "Chưa có vị trí";
        const statusClass = record.syncStatus === "synced" ? "synced" : "pending";
        const statusText = record.syncStatus === "synced" ? "Đã đồng bộ" : "Chờ đồng bộ";

        return `
            <article>
                <h3>${escapeHtml(record.interviewee)} - ${escapeHtml(record.major)}</h3>
                <p>${escapeHtml(record.createdAtText)} · ${escapeHtml(record.sessionType)}</p>
                <div class="meta-row">
                    <span class="badge ${statusClass}">${statusText}</span>
                    <span class="badge">${escapeHtml(record.schoolYear)}</span>
                    <span class="badge">Hài lòng ${escapeHtml(record.overallSatisfaction)}/5</span>
                    <span class="badge">${escapeHtml(location)}</span>
                    ${record.photoIncluded ? '<span class="badge">Có ảnh</span>' : ""}
                </div>
            </article>
        `;
    }).join("");
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function handleSubmit(event) {
    event.preventDefault();

    const record = makeRecord();
    await saveRecord(record);
    form.reset();
    photoDataUrl = "";
    photoPreview.classList.add("hidden");
    photoPreview.removeAttribute("src");
    $("#interview-time").value = formatTime();
    locationStatus.textContent = "Chưa lấy vị trí";
    updateRangeOutputs();
    await refreshHistory();

    if (navigator.onLine && getEndpoint()) {
        await syncPendingRecords();
    } else if (navigator.onLine) {
        showToast("Đã lưu phiếu. Dán Google Apps Script URL để đồng bộ lên Sheet.");
    } else {
        showToast("Đang offline: phiếu đã lưu trên thiết bị và sẽ tự đồng bộ khi online.");
    }
}

async function exportJson() {
    const records = await getAllRecords();
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vku-library-survey-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function setupTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
            tab.classList.add("active");
            $(`#${tab.dataset.tab}-tab`).classList.remove("hidden");
        });
    });
}

async function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("sw.js");
    }
}

async function init() {
    db = await openDatabase();
    endpointInput.value = getEndpoint();
    $("#interview-time").value = formatTime();

    updateRangeOutputs();
    setupTabs();
    updateNetworkStatus();
    await refreshHistory();
    await registerServiceWorker();

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    form.addEventListener("submit", handleSubmit);
    photoInput.addEventListener("change", handlePhotoChange);
    $("#get-location").addEventListener("click", getLocation);
    $("#sync-now").addEventListener("click", syncPendingRecords);
    $("#export-json").addEventListener("click", exportJson);
    $("#toggle-settings").addEventListener("click", () => $("#settings-body").classList.toggle("hidden"));
    $("#save-endpoint").addEventListener("click", async () => {
        localStorage.setItem(ENDPOINT_KEY, endpointInput.value.trim());
        showToast("Đã lưu cấu hình Google Sheet.");
        await syncPendingRecords();
    });
}

init().catch((error) => {
    console.error(error);
    showToast("Không thể khởi động ứng dụng. Hãy thử tải lại trang.");
});
