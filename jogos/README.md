# Mesa de Jogos

Plataforma de jogos de mesa brasileiros para **Android e iPhone**, no estilo
das salas de jogos online: um lobby com fichas e vários jogos dentro.

| Jogo    | Situação                                      |
|---------|-----------------------------------------------|
| Dominó  | ✅ Pronto: em duplas contra bots, até 6 pontos |
| Cacheta | ✅ Pronto: 4 jogadores contra bots             |
| Tranca  | 🔜 Próximo                                     |
| Truco, Buraco, Damas | 🔜 Planejados                    |

## Chat e emojis na mesa

Toda mesa tem:
- **💬 Chat da mesa** (no topo): mensagens livres e frases rápidas. As falas
  também aparecem em balões em cima de quem falou.
- **😀 Reações** (canto da mesa): emojis grandes que aparecem em cima do seu
  lugar, sem abrir o chat.

Por enquanto quem responde são os bots. No multiplayer online, o mesmo módulo
(`social.js`) passa a enviar e receber pela rede.

## Como funciona

O app é feito em HTML/CSS/JavaScript puro (sem etapa de build) e empacotado
para as lojas com o [Capacitor](https://capacitorjs.com):

```
jogos/
├── www/                     ← o app (é isso que vai dentro do APK / iOS)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── domino-engine.js   regras do dominó (sem tela, testável)
│       ├── cacheta-engine.js  regras da cacheta (sem tela, testável)
│       ├── ui-domino.js       tela do dominó
│       ├── ui-cacheta.js      tela da cacheta
│       ├── util.js            componentes (pedra, carta, modal, fichas)
│       ├── social.js          chat da mesa e reações com emoji
│       └── app.js             lobby e lista de jogos
├── test/engines.test.js     testes das regras (centenas de partidas bot × bot)
├── capacitor.config.json
└── package.json
```

As regras de cada jogo ficam separadas da tela (`*-engine.js`). Quando
entrar o multiplayer online, esses mesmos arquivos podem rodar no servidor,
para ninguém trapacear.

### Adicionar um jogo novo

1. Crie `www/js/<jogo>-engine.js` (regras) e `www/js/ui-<jogo>.js` (tela com `mount(container, ctx)`).
2. Inclua os dois no `index.html` e no `sw.js`.
3. Registre o jogo na lista `GAMES` em `www/js/app.js`.

## Rodar no computador

```bash
cd jogos
npm install
npm test          # testa as regras
npm run serve     # abre em http://localhost:8080
```

## Mandar para alguém testar

### Android (APK)
A cada push na pasta `jogos/`, o GitHub Actions compila o APK
(workflow **Mesa de Jogos - APK Android**). Na página da execução, baixe o
artefato `mesa-de-jogos-apk`, descompacte o `.zip` e mande o
`mesa-de-jogos.apk` (por WhatsApp, por exemplo). No celular, é preciso
permitir "instalar apps de fontes desconhecidas".

Para gerar na sua máquina (precisa do Android Studio):

```bash
npm install
npm run android
cd android && ./gradlew assembleDebug
```

### iPhone
- **Rápido (sem custo):** publique a pasta `www/` em qualquer hospedagem com
  HTTPS (GitHub Pages, Netlify, Vercel). No iPhone, abra no Safari →
  Compartilhar → **Adicionar à Tela de Início**. Vira um app em tela cheia e
  funciona offline.
- **App de verdade (TestFlight / App Store):** precisa de um Mac com Xcode e de
  uma conta Apple Developer (US$ 99/ano): `npm run ios`, depois `npx cap open ios`.

## Próximos passos

1. Tranca (em duplas, com canastras).
2. Multiplayer online: servidor com WebSocket, salas e mesas. O backend Go
   deste repositório pode ser reaproveitado.
3. Login, ranking e fichas salvas no servidor.
4. Publicação na Play Store e na App Store.
