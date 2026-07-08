const firebaseConfig = {
  apiKey: "AIzaSyA71_dQ_pcErcJEuAU_Qs5I15bdcNd5Vpo",
  authDomain: "hare-power.firebaseapp.com",
  databaseURL: "https://hare-power-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hare-power",
  storageBucket: "hare-power.firebasestorage.app",
  messagingSenderId: "119267130355",
  appId: "1:119267130355:web:43c769b849f9bee4727086"
};

const FIREBASE_SDK_VERSION = "10.12.5";

const elements = {
  sideLabel: document.querySelector("#sideLabel"),
  connectionStatus: document.querySelector("#connectionStatus"),
  sendForm: document.querySelector("#sendForm"),
  yourName: document.querySelector("#yourName"),
  targetName: document.querySelector("#targetName"),
  powerAmount: document.querySelector("#powerAmount"),
  sendMessage: document.querySelector("#sendMessage"),
  receivedPower: document.querySelector("#receivedPower"),
  receivedFrom: document.querySelector("#receivedFrom"),
  receivedMessage: document.querySelector("#receivedMessage"),
  myUrl: document.querySelector("#myUrl"),
  partnerUrl: document.querySelector("#partnerUrl"),
  copyPartnerUrlButton: document.querySelector("#copyPartnerUrlButton"),
  newRoomButton: document.querySelector("#newRoomButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  historyList: document.querySelector("#historyList"),
  toast: document.querySelector("#toast")
};

const params = new URLSearchParams(window.location.search);
const roomId = cleanRoomId(params.get("room")) || createRoomId();
const side = getSide();
const partnerSide = side === "a" ? "b" : "a";
const myUrl = buildUrl(side, roomId);
const partnerUrl = buildUrl(partnerSide, roomId);
let store;
let toastTimer;
let latestNotifiedIncomingAt = 0;
let hasRenderedOnce = false;

init();

async function init() {
  ensureUrlHasRoom();
  elements.sideLabel.textContent = side === "a" ? "あなた用URL A" : "あなた用URL B";
  elements.myUrl.textContent = myUrl;
  elements.partnerUrl.textContent = partnerUrl;

  restoreNames();
  bindEvents();

  store = await createStore();
  await store.listen(renderState);
  updateStatus();
}

function bindEvents() {
  elements.sendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const senderName = elements.yourName.value.trim();
    const targetName = elements.targetName.value.trim();
    const amountText = elements.powerAmount.value.trim();
    const hasAmount = amountText !== "";
    const amount = hasAmount ? Number(amountText) : null;
    const message = elements.sendMessage.value.trim();

    if (!senderName || !targetName || (!hasAmount && !message)) {
      showToast("入力を確認してください。");
      return;
    }

    if (hasAmount && (!Number.isFinite(amount) || amount < 1)) {
      showToast("晴れパワーは1以上の数字で入力してください。");
      return;
    }

    const payload = {
      side,
      senderName,
      targetName,
      amount: hasAmount ? Math.round(amount) : null,
      message
    };

    try {
      saveNames(senderName, targetName);
      await store.sendPower(payload);
      elements.sendMessage.value = "";
      showToast(`${formatSentContent(payload)}を送信しました☀️`);
    } catch {
      showToast("送信できませんでした。URLかFirebaseルールを確認してください。");
    }
  });

  elements.copyPartnerUrlButton.addEventListener("click", async () => {
    await copyText(partnerUrl);
    showToast("相手用URLをコピーしました。");
  });

  elements.newRoomButton.addEventListener("click", () => {
    const newRoomId = createRoomId();
    window.location.href = buildUrl("a", newRoomId);
  });

  elements.clearHistoryButton.addEventListener("click", async () => {
    const shouldClear = window.confirm("この部屋のやりとり履歴を消しますか？相手の画面からも消えます。");
    if (!shouldClear) {
      return;
    }

    try {
      await store.clearHistory();
      showToast("履歴を消しました。");
    } catch {
      showToast("履歴を消せませんでした。少し待ってもう一度試してください。");
    }
  });
}

function renderState(state) {
  const history = state.history || [];
  const incoming = [...history]
    .reverse()
    .find((item) => item.type === "send" && item.side && item.side !== side);

  if (incoming) {
    elements.receivedPower.textContent = formatIncomingMain(incoming);
    elements.receivedFrom.textContent = `${incoming.senderName || "相手"}から${incoming.targetName ? ` ${incoming.targetName}へ` : ""}届いています☀️`;
    elements.receivedMessage.textContent = incoming.message || "メッセージはありません。";
    if (!elements.targetName.value && incoming.senderName) {
      elements.targetName.value = incoming.senderName;
    }
  } else {
    elements.receivedPower.textContent = "まだ届いていません";
    elements.receivedFrom.textContent = "";
    elements.receivedMessage.textContent = "相手からの送信を待っています。";
  }

  renderHistory(history);
  notifyIncoming(incoming);
}

function renderHistory(history) {
  elements.historyList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-text";
    empty.textContent = "まだ履歴はありません。";
    elements.historyList.appendChild(empty);
    return;
  }

  history.slice(-12).reverse().forEach((item) => {
    const row = document.createElement("article");
    const title = document.createElement("strong");
    const body = document.createElement("span");
    const isMine = item.side === side;

    row.className = `history-item ${isMine ? "is-mine" : "is-partner"}`;
    title.textContent = `${isMine ? "あなた" : "相手"}から ${formatSentContent(item)}`;
    body.textContent = `${item.senderName || "ななし"} → ${item.targetName || "相手"}：${item.message || ""}`;

    row.append(title, body);
    elements.historyList.appendChild(row);
  });
}

function notifyIncoming(incoming) {
  if (!incoming) {
    hasRenderedOnce = true;
    return;
  }

  const createdAt = incoming.createdAt || 0;
  if (!hasRenderedOnce) {
    latestNotifiedIncomingAt = createdAt;
    hasRenderedOnce = true;
    return;
  }

  if (createdAt <= latestNotifiedIncomingAt) {
    return;
  }

  latestNotifiedIncomingAt = createdAt;
  showToast(`${incoming.senderName || "相手"}から${formatSentContent(incoming)}が届きました☀️`);
  vibrateOnIncoming();
}

function vibrateOnIncoming() {
  if ("vibrate" in navigator) {
    navigator.vibrate([120, 60, 120]);
  }
}

function hasPowerAmount(item) {
  return Number.isFinite(Number(item.amount)) && Number(item.amount) >= 1;
}

function formatSentContent(item) {
  if (hasPowerAmount(item)) {
    return `${Math.round(Number(item.amount))}億晴れパワー`;
  }

  return "メッセージ";
}

function formatIncomingMain(item) {
  if (hasPowerAmount(item)) {
    return `${Math.round(Number(item.amount))}億晴れパワー`;
  }

  return "メッセージが届きました";
}

async function createStore() {
  if (isFirebaseConfigured()) {
    try {
      return await createFirebaseStore();
    } catch (error) {
      console.warn(error);
      showToast("Firebase接続に失敗したので、デモ保存で動かします。");
    }
  }

  return createLocalStore();
}

async function createFirebaseStore() {
  const [{ initializeApp }, databaseModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`)
  ]);
  const {
    getDatabase,
    onValue,
    push,
    ref,
    serverTimestamp,
    set,
    update
  } = databaseModule;
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const roomRef = ref(database, `rooms/${roomId}`);

  return {
    mode: "firebase",
    async listen(callback) {
      onValue(roomRef, (snapshot) => {
        callback(normalizeState(snapshot.val() || {}));
      });
    },
    async sendPower(payload) {
      const sendPayload = {
        type: "send",
        ...payload,
        createdAt: Date.now()
      };
      await update(roomRef, {
        latest: sendPayload,
        "meta/urlA": buildUrl("a", roomId),
        "meta/urlB": buildUrl("b", roomId),
        "meta/updatedAt": serverTimestamp()
      });
      await set(push(ref(database, `rooms/${roomId}/history`)), sendPayload);
    },
    async clearHistory() {
      await update(roomRef, {
        latest: null,
        history: null,
        "meta/updatedAt": serverTimestamp()
      });
    }
  };
}

function createLocalStore() {
  const key = `hare-power-room:${roomId}`;
  let callback = () => {};

  window.addEventListener("storage", (event) => {
    if (event.key === key) {
      callback(readLocalState());
    }
  });

  return {
    mode: "local",
    async listen(next) {
      callback = next;
      callback(readLocalState());
    },
    async sendPower(payload) {
      const state = readLocalState();
      const sendPayload = {
        type: "send",
        ...payload,
        createdAt: Date.now()
      };
      state.latest = sendPayload;
      state.history = [...(state.history || []), sendPayload];
      writeLocalState(state);
      callback(readLocalState());
    },
    async clearHistory() {
      const state = readLocalState();
      state.latest = null;
      state.history = [];
      writeLocalState(state);
      callback(readLocalState());
    }
  };

  function readLocalState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(key)) || {});
    } catch {
      return normalizeState({});
    }
  }

  function writeLocalState(state) {
    localStorage.setItem(key, JSON.stringify(state));
  }
}

function normalizeState(rawState) {
  const history = rawState.history
    ? Object.values(rawState.history)
        .filter((item) => item && item.type === "send")
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    : [];

  return {
    latest: rawState.latest || null,
    history
  };
}

function updateStatus() {
  elements.connectionStatus.textContent = store.mode === "firebase"
    ? "Firebaseに接続中です。同じ部屋の相手URLとリアルタイムでつながります。"
    : "Firebase未設定のため、この端末だけのデモ保存で動いています。";
}

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.apiKey.includes("YOUR_") &&
    !firebaseConfig.databaseURL.includes("YOUR_")
  );
}

function getSide() {
  const urlSide = params.get("side");
  if (urlSide === "a" || urlSide === "b") {
    return urlSide;
  }

  const legacyRole = params.get("role");
  return legacyRole === "receiver" ? "b" : "a";
}

function buildUrl(nextSide, nextRoomId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("role");
  url.searchParams.set("side", nextSide);
  url.searchParams.set("room", nextRoomId);
  return url.toString();
}

function ensureUrlHasRoom() {
  if (params.get("side") === side && cleanRoomId(params.get("room"))) {
    return;
  }

  window.history.replaceState({}, "", myUrl);
}

function cleanRoomId(value) {
  return value ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) : "";
}

function createRoomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

function restoreNames() {
  const names = JSON.parse(localStorage.getItem("hare-power-names") || "{}");
  elements.yourName.value = names.yourName || "";
  elements.targetName.value = names.targetName || "";
}

function saveNames(yourName, targetName) {
  localStorage.setItem("hare-power-names", JSON.stringify({ yourName, targetName }));
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}
