# iPhone Linux Webcam

Transforma a câmera do iPhone em uma fonte de vídeo local para usar no Linux e no OBS Studio, sem criar aplicativo iOS e sem publicar nada na App Store.

O iPhone usa Safari + WebRTC. O computador Linux roda um servidor local que entrega as páginas e faz a sinalização da conexão.

## Requisitos

- Node.js 20 ou mais recente
- OpenSSL
- iPhone e Linux na mesma rede Wi-Fi
- OBS Studio

## Instalando no PC

Se você recebeu o `.deb`, instale com:

```bash
sudo apt install ./iphone-webcam_0.1.0_amd64.deb
```

Depois abra pelo menu procurando por `iPhone Webcam`.

Dentro desta pasta, instale o comando local:

```bash
npm run install-local
```

Para instalar também o atalho no menu de aplicativos do Linux:

```bash
npm run install-desktop
```

Depois você pode abrir pelo menu procurando por `iPhone Webcam`.

Se preferir pelo terminal, inicie o serviço:

```bash
iphone-webcam
```

Isso inicia **um único serviço HTTPS local no Linux**. O terminal vai mostrar algo assim:

```text
Conectar iPhone: https://192.168.0.10:8766/phone.html
Fonte OBS:       http://localhost:8765/viewer.html
```

No iPhone, abra a URL `Conectar iPhone` no Safari. Como o certificado é local e autoassinado, aceite o aviso de segurança. Toque em `Iniciar câmera` e permita o acesso à câmera.

No OBS Studio, adicione uma fonte `Browser` e use a URL `Fonte OBS`. Defina uma resolução como `1920x1080`.

A URL do OBS usa `localhost` de propósito: o OBS roda no próprio PC, então ele não precisa passar pelo certificado HTTPS do iPhone.

Para rodar sem instalar globalmente, use:

```bash
npm start
```

Para abrir a tela de controle e iniciar o serviço em segundo plano:

```bash
iphone-webcam-app
```

## Salas

Por padrão tudo usa a sala `default`. Para usar mais de uma câmera ou evitar conexão antiga, adicione `?room=nome` nas duas URLs:

```text
https://192.168.0.10:8766/phone.html?room=principal
http://localhost:8765/viewer.html?room=principal
```

## Observações

- O Safari no iPhone exige HTTPS para liberar a câmera em páginas que não sejam `localhost`.
- O certificado local é criado automaticamente em `~/.local/share/iphone-linux-webcam/certs`.
- O vídeo não passa pela internet; ele fica na rede local.
- Para áudio, a versão inicial deixa `audio: false`, porque OBS geralmente captura microfone separado com mais controle.
- Se o OBS tiver problema com certificado autoassinado, abra `/viewer.html` em um navegador e capture a janela como alternativa.
