const room = new URLSearchParams(location.search).get("room") || "default";
const peer = `viewer-${crypto.randomUUID()}`;
const statusEl = document.querySelector("#status");
const remote = document.querySelector("#remote");
const session = crypto.randomUUID();

let pc;
let lastMessageId = 0;
let connected = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function setObsRotation(rotation) {
  const normalized = Number(rotation) || 0;
  remote.style.setProperty("--video-rotation", `${normalized}deg`);
  remote.classList.toggle("rotated-sideways", Math.abs(normalized) === 90);
}

async function send(type, payload) {
  await fetch(`/api/rooms/${room}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from: peer, type, payload }),
  });
}

async function createOffer() {
  pc?.close();
  connected = false;
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.addTransceiver("video", { direction: "recvonly" });

  pc.ontrack = ({ streams }) => {
    remote.srcObject = streams[0];
    setStatus("recebendo vídeo");
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) send("candidate", { session, candidate });
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "connected") {
      connected = true;
      setStatus("conectado");
    }
    if (["failed", "disconnected", "closed"].includes(state)) setStatus(state);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await send("offer", { session, description: pc.localDescription });
  setStatus("aguardando iPhone");
}

async function handleMessage(message) {
  if (message.type === "answer" && pc && message.payload.session === session) {
    await pc.setRemoteDescription(message.payload.description);
  }

  if (message.type === "candidate" && pc && message.payload.session === session) {
    await pc.addIceCandidate(message.payload.candidate).catch(() => {});
  }

  if (message.type === "ready" && !connected) {
    await createOffer();
  }

  if (message.type === "control") {
    setObsRotation(message.payload.obsRotation);
  }
}

async function poll() {
  while (true) {
    try {
      const response = await fetch(`/api/rooms/${room}/poll?peer=${peer}&after=${lastMessageId}`);
      const data = await response.json();
      for (const message of data.messages) {
        lastMessageId = Math.max(lastMessageId, message.id);
        await handleMessage(message);
      }
    } catch {
      setStatus("reconectando");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

createOffer().catch((error) => setStatus(error.message));
setInterval(() => {
  if (!connected) createOffer().catch((error) => setStatus(error.message));
}, 4000);
poll();
