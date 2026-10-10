# Installér Visitkort på din Cloudflare-konto

Repository: https://github.com/jacobnitter-NIT/visitkort

Dit screenshot viser en **Worker** med GitHub-forbindelse. Projektet er lavet til netop dette, ikke Cloudflare Pages.

## 1. Opret databasen og aktivér billedlager

I Cloudflare:

1. Vælg den konto, hvor `visitkort`-Worker ligger.
2. Under **Storage & databases → D1**, opret databasen **visitkort-db**. Kopiér dens database-ID. Vælg EU-placering/jurisdiktion, hvis du ønsker det; Worker-, R2- og AI-behandling skal vurderes separat, hvis dataplacering er et krav.
3. Under **R2 Object Storage**, aktivér R2, hvis det ikke allerede er aktiveret. Cloudflare kan kræve betalingsopsætning.
4. Bucketen skal hedde **visitkort-files**. Du kan oprette den nu eller lade setup-scriptet gøre det. Aktivér ikke `r2.dev` eller anden offentlig adgang.

Bindings i appen er **DB** (D1), **FILES** (R2), **AI** (Workers AI) og **ASSETS** (appfiler). De står i `wrangler.jsonc`. Ressourcerne skal tilhøre samme konto som Workeren.

Wrangler kan automatisk provisionere manglende ressourcer ved deploy. Vi anbefaler engangsopsætningen nedenfor, så database-ID, tabeller og login er indstillet før første brug.

## 2. Kør setup i dit GitHub Codespace

Åbn repositoryet → **Code → Codespaces → Create codespace on main**. Åbn terminalen i projektmappen:

```bash
npm ci
npm run setup
```

Scriptet åbner Cloudflare-login. Hvis du kører fra en ekstern terminal/Codespaces, kopiér loginlinket og fuldfør login i browseren på din konto. Hvis callback ikke kan åbnes fra Codespaces, følg Wranglers anvisninger eller kør fra en lokal terminal.

Derefter spørger scriptet efter:

- Det rigtige D1-database-ID fra trin 1.
- Om `visitkort-files` skal oprettes. Svar `n`, hvis den allerede findes.
- Din private adgangskode (mindst 12 tegn). Indtastning er skjult.

Scriptet gemmer **ADMIN_PASSWORD_HASH** og **SESSION_SECRET** som Cloudflare Worker Secrets og opretter D1-tabeller. Adgangskoden sendes ikke til GitHub og må ikke skrives ind i repositoryet.

Hvis Cloudflare nægter kommandoerne, kontrollér, at du er logget ind på den korrekte konto og har adgang til Workers, D1 og R2. Scriptet stopper ved en fejl; gentag det efter rettelsen. D1-migrationer kan køres igen uden at slette data.

## 3. Test og udgiv

```bash
npm test
npm run deploy:check
npm run deploy
```

Wrangler viser den udgivne URL. Konfigurationen sætter `workers_dev: true`; adressen følger normalt formen `https://visitkort.<dit-subdomæne>.workers.dev`. Brug adressen fra det vellykkede deploy, ikke en gættet adresse.

Commit database-ID'et til GitHub, så den automatiske deployment bruger samme database:

```bash
git add wrangler.jsonc
git commit -m "Configure Visitkort D1 database"
git push
```

Database-ID'et er ikke en adgangskode. `.dev.vars`, sessionsecrets og kodeord må aldrig committes.

## 4. Ret GitHub-buildet i Cloudflare

Under **Workers & Pages → visitkort → Settings → Build**:

| Indstilling       | Værdi                     |
| ----------------- | ------------------------- |
| Repository        | jacobnitter-NIT/visitkort |
| Produktionsbranch | main                      |
| Rodmappe          | repositoryets rod         |
| Build command     | `npm run build`           |
| Deploy command    | `npx wrangler deploy`     |
| Node-version      | 22 eller nyere            |

Cloudflare installerer afhængighederne fra `package-lock.json`. Hvis installation skal angives eksplicit i din opsætning, brug `npm ci && npm run build` som buildkommando. Deploymenttokenet til Workers Builds skal også have de nødvendige rettigheder til D1/R2, hvis din konto kræver dette. Aktivér Workers.dev under **Domains & Routes**, hvis URL'en stadig står som Disabled efter deployment.

Hvis seneste build fejler: åbn buildloggen. De typiske fejl er manglende `dist` (buildkommandoen), manglende R2-aktivering, forkert database-ID eller manglende kontoadgang. Arbejderens navn i konfigurationen er **visitkort**, som på dit screenshot.

## 5. Aktivér modeladgang til scanning

AI-bindingen er allerede med. Scanneren bruger **@cf/meta/llama-3.2-11b-vision-instruct**.

Cloudflare kræver, at kontoejeren accepterer modellens Meta-licens og brugsvilkår. Læs og acceptér dem på din egen konto. Cloudflares modelvejledning beskriver et indledende modelkald med `{"prompt":"agree"}`. Dette skal kun køres, efter du selv har accepteret vilkårene. Appen accepterer ikke licenser på dine vegne.

Officiel vejledning: https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/

Tag derefter et foto af et rigtigt visitkort i appen. Kontrollér mail, navn og telefon før gemning. Hvis AI fejler, bevares billedet i kontaktudkastet, så du kan udfylde manuelt. Fotoaflæsningens kvalitet og kameraet skal afprøves på din telefon efter deploy.

## Første brug

1. Log ind med adgangskoden fra setup.
2. Åbn **Mit visitkort → Rediger mit kort**. Indtast dine detaljer og upload et portræt.
3. **Kontaktdata i QR** fungerer direkte med kontaktfelter. **Profil med billede** kræver, at du aktivt opretter profillinket.
4. Åbn **Indstillinger**, og vælg et aktuelt event, hvis du scanner ved en konference.
5. Scan dit første visitkort, kontrollér detaljerne, og gem.
6. Vælg **Del kontakt** for at lave et udvalgt, tidsbegrænset link til en kollega. Ingen beskeder sendes automatisk.
7. Installér appen fra Chrome-menuen → **Installér app / Føj til startskærm**. Menuens navn kan variere.

Telefonintegration: **Gem i telefonens kontakter** henter en `.vcf`-fil. Åbn/importér den i Samsung/Google Kontakter. Appen synkroniserer ikke automatisk. Import fra kontaktvælger vises kun i understøttede browsere.

## Vedligeholdelse

- Ny kode: GitHub-buildet udgiver den efter push til main, når opsætningen er korrekt.
- Nye databaseændringer: `npm run db:remote` før den nye kode tages i brug.
- Skift adgangskode: kør `npm run setup` igen, med samme database og eksisterende bucket (`n`). Scriptet roterer også sessionsnøglen, så gamle sessioner lukkes.
- Tilbagekald link: **Indstillinger → Delingslinks → Deaktivér**.
- Kontaktdataeksport: **Indstillinger → Eksport & import**. JSON indeholder ikke billedfiler. Tag særskilt backup af R2 og D1, hvis du ønsker et komplet backup.
- Ekstra Cloudflare Access-login er valgfrit. Beskyt ikke hele domænet uden undtagelser for offentlige visitkort, da delingslinks ellers ikke kan åbnes af modtagere.

## Hvad er verificeret inden levering?

TypeScript/produktionsbuild, Worker-pakning og lokale integrationstests af login, adgangskontrol, D1-kontakter, CRM-historik, deling, udløb/tilbagekaldelse og vCard/QR-formater. Der er ingen ændringer foretaget i din Cloudflare-konto fra udviklingsmiljøet. Visuel browserkontrol, AI-modelkald, fysisk kamerascanning, Samsung-kontaktimport og live deployment kræver efterfølgende afprøvning på din konto/enhed.
