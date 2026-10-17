# JJ in Los Angeles aufs iPhone – nur mit dem Handy

Kein Mac nötig: Die App wird von einem **Mac in der Cloud** (GitHub Actions) gebaut und automatisch zu
**TestFlight** hochgeladen. Du richtest nur Konten ein und trägst 4 Werte bei GitHub ein.

---

## Teil A – HEUTE spielbar (10 Minuten, kostenlos)
Damit dein Kollege schon spielen kann, während Apple dein Konto prüft.

1. Am Handy **app.netlify.com** öffnen → **Sign up with GitHub** (mit deinem GitHub-Konto anmelden).
2. **Add new site → Import an existing project → GitHub** → Repo **Stickman-game-** auswählen
   (falls es fehlt: „Configure the Netlify app on GitHub“ und das Repo freigeben).
3. Einstellungen:
   - **Branch to deploy:** `claude/new-session-w0yb8o`
   - **Base directory:** leer lassen
   - **Build command:** leer lassen
   - **Publish directory:** `jj-la`
4. **Deploy** tippen. Nach ~1 Minute bekommst du einen Link wie `https://irgendwas.netlify.app`.
   (Unter **Site configuration → Change site name** kannst du ihn z. B. `jj-in-la` nennen.)
5. Link an den Kollegen schicken. Er öffnet ihn in **Safari** → **Teilen-Knopf** → **„Zum Home-Bildschirm“**.
   Jetzt hat er ein App-Icon, Vollbild, läuft auch offline. Neue Versionen kommen automatisch.

---

## Teil B – echte App über TestFlight

### Schritt 1: Apple-Developer-Konto (einmalig, 99 €/Jahr)
1. Im App Store die App **„Apple Developer“** laden und öffnen.
2. Unten **Account** → mit deiner Apple-ID anmelden (Zwei-Faktor-Schutz muss an sein).
3. **Enroll now / Jetzt registrieren** → als **Einzelperson (Individual)** → Ausweis scannen → bezahlen.
4. Warten auf die Bestätigungs-Mail „Welcome to the Apple Developer Program“.
   Das dauert meist **ein paar Stunden bis 2 Tage** – vorher geht Teil B nicht weiter.

### Schritt 2: App-ID anlegen
1. Safari → **developer.apple.com/account** → **Certificates, IDs & Profiles** → **Identifiers** → „+“.
2. **App IDs** → **App** → Beschreibung `JJ in Los Angeles`, Bundle ID **Explicit**: `com.joel.jjla`
   (ist sie vergeben: z. B. `com.deinname.jjla` – dann merken, siehe Schritt 5 `BUNDLE_ID`) → **Register**.
3. Oben rechts unter **Membership details** steht deine **Team ID** (10 Zeichen, z. B. `A1B2C3D4E5`) → notieren.

### Schritt 3: App in App Store Connect anlegen
1. Safari → **appstoreconnect.apple.com** → **Apps** → „+“ → **Neue App**.
2. Plattform **iOS**, Name **JJ in Los Angeles** (falls vergeben: „JJ in LA“), Sprache Deutsch,
   Bundle-ID aus Schritt 2 auswählen, SKU `jjla001` → **Erstellen**.

### Schritt 4: API-Schlüssel erstellen (damit der Cloud-Mac hochladen darf)
1. App Store Connect → **Benutzer und Zugriff** → Reiter **Integrationen** → **App Store Connect API**
   → (einmalig „Zugriff anfordern“ bestätigen) → **Teamschlüssel** → „+“.
2. Name `GitHub`, Zugriff **Admin** → **Generieren**.
3. Notieren: **Schlüssel-ID** (Key ID) und oben die **Aussteller-ID** (Issuer ID).
4. **API-Schlüssel laden** → die Datei `AuthKey_XXXX.p8` wird gespeichert (**geht nur einmal!**).
   In der **Dateien**-App öffnen; den ganzen Text inkl. `-----BEGIN PRIVATE KEY-----` und `-----END PRIVATE KEY-----` kopieren.
   (Falls die Dateien-App sie nicht als Text zeigt: Datei in eine Notiz-App teilen und dort kopieren.)

### Schritt 5: Die 4 Werte bei GitHub eintragen
Safari → **github.com/joels27-arch/Stickman-game-** → **Settings** → **Secrets and variables** → **Actions**
→ **New repository secret**, viermal:

| Name | Wert |
|---|---|
| `APPLE_TEAM_ID` | Team ID aus Schritt 2 |
| `ASC_KEY_ID` | Schlüssel-ID aus Schritt 4 |
| `ASC_ISSUER_ID` | Aussteller-ID aus Schritt 4 |
| `ASC_KEY_P8` | kompletter Text der .p8-Datei |

Nur falls deine Bundle-ID nicht `com.joel.jjla` ist: fünftes Secret `BUNDLE_ID` mit deiner Bundle-ID.

### Schritt 6: Build starten
- Einfach Claude schreiben: **„TestFlight-Build starten“** – oder selbst:
  im Repo (Branch `claude/new-session-w0yb8o`) die Datei `jj-la-ios/BUILD.txt` öffnen → Stift → Zahl um 1 erhöhen → **Commit changes**.
- Im Reiter **Actions** läuft dann „iOS TestFlight“ (~10–20 Minuten). Grüner Haken = hochgeladen.
- Nach weiteren 5–30 Minuten ist der Build in App Store Connect unter **TestFlight** sichtbar.

### Schritt 7: Kollegen einladen
**Schnell, ohne Apple-Prüfung (interner Tester):**
1. App Store Connect → **Benutzer und Zugriff** → „+“ → Vorname, Name, **E-Mail seiner Apple-ID**, Rolle **Marketing** → Einladen.
   Er nimmt die Einladung per Mail an.
2. Deine App → **TestFlight** → **Interne Tests** → „+“ Gruppe → ihn hinzufügen → Build auswählen.
3. Er lädt die App **TestFlight** aus dem App Store → öffnet die Einladung → **Installieren**.

**Oder nur per E-Mail (externer Tester):** TestFlight → **Externe Tests** → Gruppe → E-Mail eintragen → Build hinzufügen.
Der erste Build wird von Apple kurz geprüft (meist Stunden bis 1 Tag).

---

## Wenn der Build rot wird
In GitHub → **Actions** → den roten Lauf öffnen → Fehlermeldung kopieren und Claude schicken.
Häufig: ein Secret falsch kopiert (bei `ASC_KEY_P8` fehlt die BEGIN/END-Zeile), API-Schlüssel nicht **Admin**,
oder die Bundle-ID in App Store Connect passt nicht.
