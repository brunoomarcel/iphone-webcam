const room = new URLSearchParams(location.search).get("room") || "default";
const peer = `phone-${crypto.randomUUID()}`;
const statusEl = document.querySelector("#status");
const preview = document.querySelector("#preview");
const startButton = document.querySelector("#start");
const switchButton = document.querySelector("#switch");
const previewRotateButton = document.querySelector("#preview-rotate");
const obsOrientationSelect = document.querySelector("#obs-orientation");
const qualitySelect = document.querySelector("#quality");

let facingMode = "environment";
let stream;
let pc;
let lastMessageId = 0;
let currentSession;
let previewRotation = 0;
let pendingOffer;

const sizes = {
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
};

function setStatus(text) {
  statusEl.textContent = text;
}

function sendViewerControls() {
  send("control", { obsRotation: Number(obsOrientationSelect.value) || 0 }).catch(() => {});
}

function applyPreviewRotation() {
  preview.style.setProperty("--video-rotation", `${previewRotation}deg`);
  previewRotateButton.textContent = previewRotation === 180 ? "Tela normal" : "Tela 180";
}

async function send(type, payload) {
  await fetch(`/api/rooms/${room}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from: peer, type, payload }),
  });
}

async function openCamera() {
  const oldStream = stream;
  const size = sizes[qualitySelect.value] || sizes["1080"];
  const nextStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: size.width },
      height: { ideal: size.height },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: false,
  });

  stream = nextStream;
  preview.srcObject = stream;
  setStatus("câmera pronta");
  startButton.textContent = "Reiniciar";

  if (pc) {
    const videoTrack = stream.getVideoTracks()[0];
    const sender = pc.getSenders().find((item) => item.track?.kind === "video");
    if (sender && videoTrack) {
      await sender.replaceTrack(videoTrack);
    } else {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
  }

  oldStream?.getTracks().forEach((track) => track.stop());
  await send("ready", { camera: facingMode });
  sendViewerControls();

  if (pendingOffer) {
    const offer = pendingOffer;
    pendingOffer = undefined;
    await answerOffer(offer);
  }
}

function createPeerConnection() {
  pc?.close();
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = ({ candidate }) => {
    if (candidate && currentSession) send("candidate", { session: currentSession, candidate });
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "connected") setStatus("conectado ao OBS");
    if (["failed", "disconnected", "closed"].includes(state)) setStatus(state);
  };

  if (stream) {
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  }
}

async function answerOffer(payload) {
  currentSession = payload.session;
  createPeerConnection();
  await pc.setRemoteDescription(payload.description);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await send("answer", { session: currentSession, description: pc.localDescription });
  sendViewerControls();
}

async function handleMessage(message) {
  if (message.type === "offer") {
    if (!stream) {
      pendingOffer = message.payload;
      setStatus("toque em iniciar");
      return;
    }

    await answerOffer(message.payload);
  }

  if (message.type === "candidate" && pc && message.payload.session === currentSession) {
    await pc.addIceCandidate(message.payload.candidate).catch(() => {});
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

startButton.addEventListener("click", () => {
  openCamera().catch((error) => setStatus(error.message));
});

switchButton.addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await openCamera().catch((error) => setStatus(error.message));
});

previewRotateButton.addEventListener("click", () => {
  previewRotation = previewRotation === 180 ? 0 : 180;
  applyPreviewRotation();
});

obsOrientationSelect.addEventListener("change", () => {
  sendViewerControls();
});

qualitySelect.addEventListener("change", () => {
  openCamera().catch((error) => setStatus(error.message));
});

setStatus("toque em iniciar");
applyPreviewRotation();
poll();
