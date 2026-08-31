<!-- Banner -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F0E0D,35:075E54,70:25D366,100:F5E6D3&height=240&section=header&text=zap-check&fontSize=58&fontColor=F5E6D3&animation=fadeIn&fontAlignY=38&desc=Verifique%20n%C3%BAmeros%20de%20WhatsApp%20%E2%80%94%20sem%20nunca%20arriscar%20seu%20remetente%20oficial&descAlignY=60&descSize=16" />
</div>

<!-- Typing -->
<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=21&duration=2800&pause=900&color=25D366&center=true&vCenter=true&width=840&lines=Verifique+antes+de+enviar+%E2%80%94+nunca+queime+seu+remetente;Providers+plug%C3%A1veis+%E2%80%94+UAZAPI+pronto%2C+o+seu+em+um+arquivo;O+n%C3%BAmero+que+verifica+%C3%A9+descart%C3%A1vel+%E2%80%94+o+oficial+nunca+arrisca;N%C3%BAmero+nunca+vai+pra+log+%C2%B7+segredo+s%C3%B3+por+env" />
</div>

<!-- Status -->
<div align="center">
  <img src="https://img.shields.io/badge/Para-Remetentes%20WhatsApp-075E54?style=for-the-badge&logo=whatsapp&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/Providers-Plug%C3%A1veis-25D366?style=for-the-badge&logo=plug&logoColor=white" />
  <img src="https://img.shields.io/badge/Privacidade-N%C3%BAmero%20nunca%20em%20log-0F0E0D?style=for-the-badge&logo=adguard&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/Runtime-Bun%20%2B%20TypeScript-8C4A32?style=for-the-badge&logo=bun&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-25a162?style=for-the-badge" />
</div>

> O **zap-check** responde "esse número tem WhatsApp?" antes de você gastar dinheiro e
> reputação de remetente mandando mensagem — por meio de uma conta verificadora separada e
> descartável, pra que seu remetente oficial da WhatsApp Cloud API nunca participe da
> verificação. Uma biblioteca, um CLI, um micro-serviço opcional; providers são plugáveis em
> um único arquivo.

> Não afiliado nem endossado por Meta, WhatsApp ou provider algum. "WhatsApp" é marca da Meta.

[Read in English](README.md)

<br>

## O que é

```yaml
produto:     verificação de número de WhatsApp com providers plugáveis
isolamento:  uma conta verificadora descartável checa; seu remetente oficial nunca
providers:   UAZAPI pronto — adicione o seu implementando uma interface em um arquivo
superfícies: biblioteca TypeScript · CLI · micro-serviço HTTP opcional (bearer auth)
proteção:    lotes + pausas (rate limit) blindam a conta verificadora de rajadas
privacidade: número verificado nunca vai pra log; erro nunca ecoa o corpo da requisição
segredos:    só por env (.env.example) — nunca em argv, nunca em arquivo no repo
runtime:     Bun-first, zero dependência de runtime (fetch e node:http padrão)
```

## O problema

Quem envia pela WhatsApp Cloud API oficial não tem como perguntar "esse número existe no
WhatsApp?" sem mandar mensagem de verdade. Mensagem pra número morto queima dinheiro e, pior,
reputação de remetente — o que mantém seus templates aprovados e seu número vivo.

Providers terceiros respondem essa pergunta, mas apontar um deles pro seu número oficial é
amarrar seu ativo mais valioso numa conexão não-oficial.

## Arquitetura

```
 seu app ──▶ zap-check ──▶ instância verificadora     (descartável, provider terceiro)
     │                      responde: existe / não
     │
     └──────────────────▶ remetente oficial Cloud API (só fala com número que existe)

 as duas pistas NUNCA se cruzam: se a conta verificadora for banida, troca-se;
 o remetente oficial nunca correu o risco
```

## Começando

```bash
git clone https://github.com/ricardo-landim/zap-check.git
cd zap-check
bash install.sh          # checa o Bun, roda a suíte de testes, linka o CLI
cp .env.example .env     # preencha ZAPCHECK_URL e ZAPCHECK_TOKEN
```

Biblioteca:

```ts
import { createVerifier } from "./src/index";
import { uazapiProvider } from "./src/providers/uazapi";

const verifier = createVerifier({
  provider: uazapiProvider({ url: process.env.ZAPCHECK_URL!, token: process.env.ZAPCHECK_TOKEN! }),
  batchSize: 20,      // números por chamada ao provider
  intervalMs: 1000,   // pausa entre lotes — protege a conta verificadora
  cacheTtlMs: 60_000, // cache opcional pra checagens repetidas
});

const results = await verifier.verify(["+15551234567", "+15557654321"]);
```

CLI e micro-serviço:

```bash
zap-check +15551234567 +15557654321     # uma linha por número: <número>\t<yes|no>
zap-check --health

ZAPCHECK_ACCESS_TOKEN=troque-isto bun src/server.ts    # escuta na :8377
curl -s -X POST http://localhost:8377/verify \
  -H "Authorization: Bearer troque-isto" -H "Content-Type: application/json" \
  -d '{"numbers": ["+15551234567"]}'
```

> [!NOTE]
> Nada é hospedado por ninguém: o micro-serviço roda onde você rodar, e qualquer stack
> (qualquer linguagem, sem instalar nada) consome com um POST.

## Superfícies

| | Superfície | O que faz |
|:---:|---|---|
| 📚 | `src/index.ts` | `createVerifier()` — lotes, rate limit, cache TTL opcional, dedupe |
| 🔌 | `src/providers/` | UAZAPI pronto; `_template.ts` é o contrato de um arquivo pro seu |
| ⌨️ | `zap-check <números>` | CLI — saída separada por tab, `--health`, exit codes pra script |
| 🌐 | `src/server.ts` | micro-serviço HTTP — `POST /verify`, `GET /health`, bearer auth, limite de corpo |
| 🧪 | `bun test` | 16 testes em 3 suítes, 100% contra fakes locais — nenhuma rede sai da máquina |

## Adicionando um provider (um arquivo)

Copie [`src/providers/_template.ts`](src/providers/_template.ts), implemente `check()` e
`health()`, registre em `src/config.ts`. O contrato: um resultado por número (provider que
dropa número em silêncio vira erro explícito), nunca logar os números, credencial vem por
options — o CLI e o server alimentam do env.

## Solução de problemas

> [!WARNING]
> A conta verificadora vive numa conexão não-oficial e pode ser limitada ou banida pelo
> WhatsApp a qualquer momento. Esse é o desenho: use um número que você pode perder, e nunca
> aponte o zap-check pro número do seu remetente oficial.

Se as checagens começarem a falhar, `zap-check --health` diz se a instância verificadora está
alcançável e autenticada. Um `429` do provider significa que você está forçando demais: suba o
`ZAPCHECK_INTERVAL_MS` ou desça o `ZAPCHECK_BATCH_SIZE`.

## Requisitos

- [Bun](https://bun.sh) 1.0+
- Uma instância de verificação num provider suportado (UAZAPI hoje) com URL e token

## Notas de segurança

- Número verificado nunca é escrito em log, e erro de provider nunca ecoa o corpo da
  requisição (tem provider que espelha a requisição de volta — o zap-check se recusa a
  imprimir isso).
- Segredo viaja só por env (`.env.example`); nunca em argv, onde o `ps` expõe.
- O micro-serviço tem bearer auth (`ZAPCHECK_ACCESS_TOKEN`) e limite de corpo.
- Lotes e pausas embutidos mantêm a conta verificadora fora do radar do provider.

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — invariantes e ADRs
- [`install.sh`](install.sh) — o que vai pra onde (`~/bin/zap-check`)

---

## Feito pela Six Quasar

A **Six Quasar** constrói agentes de IA que funcionam de verdade: WhatsApp como interface,
núcleo determinístico, IA na borda. Esta ferramenta nasceu da operação de frotas de WhatsApp
onde os remetentes oficiais jamais podem ser os que correm risco.

<a href="https://github.com/ricardo-landim"><img src="https://img.shields.io/badge/Perfil%20GitHub-181717?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://sixquasar.shop"><img src="https://img.shields.io/badge/sixquasar.shop-25D366?style=for-the-badge&logo=safari&logoColor=F5E6D3" /></a>

<!-- Footer -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:25D366,40:075E54,100:0F0E0D&height=120&section=footer" />
</div>
