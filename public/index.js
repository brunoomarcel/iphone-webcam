const phoneUrlEl = document.querySelector("#phone-url");
const obsUrlEl = document.querySelector("#obs-url");
const copyPhoneButton = document.querySelector("#copy-phone");
const copyObsButton = document.querySelector("#copy-obs");

let phoneUrl = "";
let obsUrl = "";

async function copy(text, button) {
  await navigator.clipboard.writeText(text);
  const previous = button.textContent;
  button.textContent = "Copiado";
  setTimeout(() => {
    button.textContent = previous;
  }, 1200);
}

async function loadInfo() {
  const response = await fetch("/api/info");
  const info = await response.json();
  phoneUrl = info.phoneUrls[0] || "Nenhum IP de rede encontrado";
  obsUrl = info.obsUrl;

  phoneUrlEl.textContent = phoneUrl;
  obsUrlEl.textContent = obsUrl;
}

copyPhoneButton.addEventListener("click", () => copy(phoneUrl, copyPhoneButton));
copyObsButton.addEventListener("click", () => copy(obsUrl, copyObsButton));

loadInfo().catch(() => {
  phoneUrlEl.textContent = "Nao foi possivel carregar";
  obsUrlEl.textContent = "Nao foi possivel carregar";
});
