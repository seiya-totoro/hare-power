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
  senderScreen: document.querySelector("#senderScreen"),
  receiverScreen: document.querySelector("#receiverScreen"),
  connectionStatus: document.querySelector("#connectionStatus"),
  receiverConnectionStatus: document.querySelector("#receiverConnectionStatus"),
  sendForm: document.querySelector("#sendForm"),
  replyForm: document.querySelector("#replyForm"),
  targetName: document.querySelector("#targetName"),
  powerAmount: document.querySelector("#powerAmount"),
  sendMessage: document.querySelector("#sendMessage"),
  senderReplyEmpty: document.querySelector("#senderReplyEmpty"),
  senderReplyText: document.querySelector("#senderReplyText"),
  receiverUrl: document.querySelector("#receiverUrl"),
  copyReceiverUrlButton: document.querySelector("#copyReceiverUrlButton"),
  receivedPower: document.querySelector("#receivedPower"),
  receivedFrom: document.querySelector("#receivedFrom"),
  receivedMessage: document.querySelector("#receivedMessage"),
  replyInput: document.querySelector("#replyInput"),
  senderHistory: document.querySelector("#senderHistory"),
  receiverHistory: document.querySelector("#receiverHistory"),
  toast: document.querySelector("#toast")
};

const params = new URLSearchParams(window.location.search);
const role = params.get("role") === "receiver" ? "receiver" : "sender";
const roomId = cleanRoomId(params.get("room")) || createRoomId();
const receiverUrl = buildUrl("receiver");
const senderUrl = buildUrl("sender");
let store;
let toastTimer;

init();

async function init() {
  ensureUrlHasRoom();
  showRoleScreen();
  elements.receiverUrl.textContent = receiverUrl;
  elements.connectionStatus.textContent = "接続準備中です。";
  elements.receiverConnectionStatus.textContent = "接続準備中です。";
  elements.connectionStatus.classList.add("is-visible");
  elements.receiverConnectionStatus.classList.add("is-visible");

  store = await createStore();
  await store.listen(renderState);
  bindEvents();
  updateStatus();
}

function bindEvents() {
  elements.sendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const targetName = elements.targetName.value.trim();
    const amount = Number(elements.powerAmount.value);
    const message = elements.sendMessage.value.trim();

    if (!targetName || !Number.isFinite(amount) || amount < 1 || !message) {
      showToast("入力を確認してください。");
      return;
    }

    await store.sendPower({
      targetName,
      amount: Math.round(amount),
      message
    });
    showToast(`${Math.round(amount)}億晴れパワーを送信しました☀️`);
  });

  elements.replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = elements.replyInput.value.trim();

    if (!text) {
      showToast("返信メッセージを入力してください。");
      return;
    }

    await store.sendReply(text);
    elements.replyInput.value = "";
    showToast("返信を送りました☁️→☀️");
  });

  elements.copyReceiverUrlButton.addEventListener("click", async () => {
    await copyText(receiverUrl);
    showToast("受け取る側URLをコピーしました。");
  });
}

function showRoleScreen() {
  document.title = role === "receiver" ? "晴れパワー受信箱" : "晴れパワー送信機";
  elements.senderScreen.classList.toggle("is-hidden", role !== "sender");
  elements.receiverScreen.classList.toggle("is-hidden", role !== "receiver");
}

function renderState(state) {
  const latest = state.latest;
  const reply = state.reply;
  const history = state.history || [];

  if (latest) {
    elements.targetName.value = latest.targetName || elements.targetName.value;
    elements.receivedPower.textContent = `${latest.amount}億晴れパワー`;
    elements.receivedFrom.textContent = `${latest.targetName || "あなた"}宛に届いています☀️`;
    elements.receivedMessage.textContent = latest.message || "メッセージはありません。";
  } else {
    elements.receivedPower.textContent = "まだ届いていません";
    elements.receivedFrom.textContent = "";
    elements.receivedMessage.textContent = "送信を待っています。";
  }

  if (reply?.text) {
    elements.senderReplyEmpty.classList.add("is-hidden");
    elements.senderReplyText.textContent = reply.text;
  } else {
    elements.senderReplyEmpty.classList.remove("is-hidden");
    elements.senderReplyText.textContent = "";
  }

  renderHistory(elements.senderHistory, history);
  renderHistory(elements.receiverHistory, history);
}

function renderHistory(container, history) {
  container.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-text";
    empty.textContent = "まだ履歴はありません。";
    container.appendChild(empty);
    return;
  }

  history.slice(-8).reverse().forEach((item) => {
    const row = document.createElement("article");
    row.className = "history-item";
    const title = document.createElement("strong");
    const body = document.createElement("span");

    if (item.type === "reply") {
      title.textContent = "返信";
      body.textContent = item.text;
    } else {
      title.textContent = `${item.amount}億晴れパワー送信`;
      body.textContent = item.message;
    }

    row.append(title, body);
    container.appendChild(row);
  });
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
  let cache = {};

  return {
    mode: "firebase",
    async listen(callback) {
      onValue(roomRef, (snapshot) => {
        cache = snapshot.val() || {};
        callback(normalizeState(cache));
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
        "meta/senderUrl": senderUrl,
        "meta/receiverUrl": receiverUrl,
        "meta/updatedAt": serverTimestamp()
      });
      await set(push(ref(database, `rooms/${roomId}/history`)), sendPayload);
    },
    async sendReply(text) {
      const replyPayload = {
        type: "reply",
        text,
        createdAt: Date.now()
      };
      await update(roomRef, {
        reply: replyPayload,
        "meta/updatedAt": serverTimestamp()
      });
      await set(push(ref(database, `rooms/${roomId}/history`)), replyPayload);
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
    async sendReply(text) {
      const state = readLocalState();
      const replyPayload = {
        type: "reply",
        text,
        createdAt: Date.now()
      };
      state.reply = replyPayload;
      state.history = [...(state.history || []), replyPayload];
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
    ? Object.values(rawState.history).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    : [];

  return {
    latest: rawState.latest || null,
    reply: rawState.reply || null,
    history
  };
}

function updateStatus() {
  const message = store.mode === "firebase"
    ? "Firebaseに接続中です。同じ秘密URLを開いた相手にも届きます。"
    : "Firebase未設定のため、この端末だけのデモ保存で動いています。READMEの手順でFirebaseを設定すると2人で使えます。";

  elements.connectionStatus.textContent = message;
  elements.receiverConnectionStatus.textContent = message;
}

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.apiKey.includes("YOUR_") &&
    !firebaseConfig.databaseURL.includes("YOUR_")
  );
}

function buildUrl(nextRole) {
  const url = new URL(window.location.href);
  url.searchParams.set("role", nextRole);
  url.searchParams.set("room", roomId);
  return url.toString();
}

function ensureUrlHasRoom() {
  if (params.get("role") === role && cleanRoomId(params.get("room"))) {
    return;
  }

  window.history.replaceState({}, "", senderUrl);
}

function cleanRoomId(value) {
  return value ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) : "";
}

function createRoomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 24);
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
