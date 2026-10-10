# Visitkort

Privat kontaktbibliotek, visitkortscanner og et let CRM til Cloudflare Workers, D1 og R2.

- Mobilvenlig app, som kan installeres på hjemmeskærmen.
- Foto af visitkort → Workers AI → gennemgang → gem kontakt.
- QR-import fra kamera, billede, vCard, MeCard eller et weblink.
- Eget digitalt visitkort med billede, vCard-QR og valgfrit offentligt profillink.
- Del udvalgte kontaktfelter med kolleger via links, der udløber og kan tilbagekaldes.
- Selskab, event/mødested, dato, tags, favoritter, status og søgning.
- CRM-tidslinje, noter og opfølgningsdatoer.
- Dubletadvarsel og sammenlægning af kontakter/historik.
- Eksport til CSV, vCard og JSON samt import af JSON-kontakter og historik.
- Import fra telefonens kontaktvælger, når browseren understøtter det.
- Offlinefoto-kladder på enheden. Databasen kræver forbindelse.

**Før appen kan bruges på din Cloudflare-konto, skal engangsopsætningen gennemføres.**
Se [INSTALLATION.md](INSTALLATION.md).

## Hurtig start i GitHub Codespaces

```bash
npm ci
npm run setup
npm run deploy:check
npm run deploy
```

Opret først en D1-database `visitkort-db` i Cloudflare, og aktivér R2. Setup spørger efter database-ID, opretter eventuelt bucket, indstiller login og opretter tabeller. Det kræver login til din egen Cloudflare-konto i terminalen.

## Udvikling og kontrol

```bash
npm ci
node scripts/setup.mjs --local
npm run build
npm run dev:worker
```

`npm run dev` er kun Vite-frontenden. Brug `dev:worker` til den komplette lokale app med API og database. AI-scanning kræver en tilkoblet Cloudflare-konto og modeladgang; de øvrige funktioner kan testes lokalt.

```bash
npm test
npm run deploy:check
```

## Privat adgang og deling

Biblioteket har ét ejerlogin. Der er ingen offentlig brugerregistrering. Kodeordet lagres som en saltet PBKDF2-hash i en Worker Secret. Sessioner er signerede, HttpOnly, Secure og SameSite=Strict, og loginforsøg begrænses. Alle private API'er kræver login, og ændringer kontrollerer Origin. Manglende secrets lukker appen for adgang.

Kun `/p/<tilfældig-token>` og tilsvarende `/api/public/...` er offentlig læsning. Kontaktlinks er snapshots af netop de valgte felter; eget profilkort viser de aktuelle kontaktfelter og profilbillede. Profilen kan deaktiveres. Noter deles kun ved aktivt tilvalg for kontaktlinks; historik, event, tags og opfølgningsopgaver deles aldrig.

R2 skal forblive privat. Billeder leveres via API'et. Ubrugte billeder ryddes op efter syv dage; billeder fjernes også ved redigering/sletning, når de ikke længere refereres af en kontakt, profil eller et aktivt delingslink. Cronjobbet behandler højst 20 ubrugte billeder pr. dag. Delingslinket kan tilbagekaldes, men allerede importerede kontaktfiler eller screenshots kan ikke tilbagekaldes.

## Begrænsninger i version 1.0

- Telefonkontakter gemmes via vCard-import. Der er ingen automatisk Google/Microsoft-synkronisering.
- En QR med et eksternt weblink importeres som et link. Appen scraper ikke tredjepartssider. Egne aktive profillinks kan importeres som kontaktfelter.
- Scanning kan fejllæse tekst. Kontrollér felterne før gemning. Foto sendes til Cloudflare Workers AI; billeder og kontaktdata kan medføre forbrug på din konto.
- Automatisk beskæring, redigering af eksisterende interaktionsnoter og mailpåmindelser er ikke med. Interaktioner kan tilføjes og slettes; opfølgningslisten vises i appen.
- JSON er en dataeksport, ikke et komplet billedbackup. Den inkluderer profilfelter, men import genskaber kun kontakter og historik. Billeder og profil genskabes separat. Import er atomisk og tilføjer nye poster, maks. 1000 kontakter ad gangen (1,5 MB JSON).
- Biblioteket indlæser op til 5000 kontakter. Denne version er beregnet til et privat bibliotek.
- Offline-kladder er lokale og uploades ikke automatisk. De forbliver på enheden efter logout, indtil de aflæses eller slettes. Private kontaktlister og API-svar caches ikke af service workeren.
- Logout fjerner sessionen i den aktuelle browser. Skift SESSION_SECRET for at lukke alle sessioner. Reset af adgangskode sker med setup-scriptet.

## Struktur

`src/`: React-app og kontaktformater. `worker/`: API, login og billedaflæsning. `migrations/`: D1-tabeller. `public/`: PWA-ikoner og headers. `scripts/`: engangsopsætning og sikker caching af appskallen. `tests/`: vCard/QR og D1/R2-adgangstests.
