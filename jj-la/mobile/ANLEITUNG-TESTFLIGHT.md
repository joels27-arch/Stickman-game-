# JJ in Los Angeles → TestFlight (iPhone)

Das Xcode-Projekt ist fertig vorbereitet (Capacitor 8). Auf dem Mac brauchst du **nur Xcode**, kein Node, kein Terminal.
App-ID: `com.joel.jjla` · Name: „JJ in Los Angeles“ · nur iPhone · nur Querformat · Vollbild.

## Was du brauchst
- Einen Mac mit **Xcode 16 oder neuer** (kostenlos im Mac App Store).
- Ein **Apple-Developer-Konto** (99 €/Jahr, developer.apple.com → „Account“). Ohne bezahltes Konto geht TestFlight nicht.
- Die Apple-ID deines Kollegen (seine E-Mail-Adresse).

## 1. Projekt auf den Mac holen
1. Auf github.com das Repo öffnen, Branch `main` wählen → **Code → Download ZIP**, entpacken.
   (Oder im Terminal: `git clone -b main <repo-url>`.)
2. Im Finder in den Ordner `jj-la/mobile/ios/App/` gehen und **`App.xcodeproj`** doppelklicken. Xcode öffnet sich.
3. Kurz warten: Xcode lädt oben links „Package Dependencies“ (Capacitor) automatisch herunter.

## 2. Signieren (einmalig)
1. Xcode → Menü **Xcode → Settings → Accounts** → „+“ → Apple-ID mit dem Developer-Konto hinzufügen.
2. Links im Projektbaum auf **App** (blaues Symbol) klicken → Target **App** → Reiter **Signing & Capabilities**.
3. Haken bei **Automatically manage signing**, bei **Team** dein Team wählen.
4. Steht bei Bundle Identifier ein Fehler („not available“), ändere `com.joel.jjla` auf etwas Eigenes, z. B. `com.deinname.jjla`.

## 3. App in App Store Connect anlegen (einmalig)
1. appstoreconnect.apple.com → **Apps** → „+“ → **Neue App**.
2. Plattform iOS, Name „JJ in Los Angeles“ (falls vergeben: „JJ in LA“), Sprache Deutsch,
   Bundle-ID = die aus Schritt 2, SKU z. B. `jjla001`, Zugriff „Voller Zugriff“ → **Erstellen**.

## 4. Build hochladen
1. In Xcode oben in der Leiste als Ziel **Any iOS Device (arm64)** auswählen (nicht einen Simulator).
2. Menü **Product → Archive**. Dauert 1–3 Minuten.
3. Es öffnet sich der **Organizer** → **Distribute App** → **App Store Connect** → **Upload** → immer „Next“ → **Upload**.
4. Nach 5–30 Minuten erscheint der Build in App Store Connect unter deiner App → Reiter **TestFlight**
   (Status zuerst „Wird verarbeitet“). Die Frage zur Verschlüsselung ist schon beantwortet (keine).

## 5. Kollegen einladen – noch heute, ohne Apple-Prüfung
**Interne Tester** (sofort, keine Prüfung):
1. App Store Connect → **Benutzer und Zugriff** → „+“ → Kollege mit seiner Apple-ID-E-Mail, Rolle z. B. **Marketing** oder **Developer** → Einladen.
   Er muss die Einladungs-Mail annehmen.
2. Deine App → **TestFlight** → links **Interne Tests** → „+“ Gruppe anlegen → Kollege hinzufügen → Build auswählen.
3. Der Kollege installiert die App **TestFlight** aus dem App Store, öffnet die Einladung → **Installieren**. Fertig.

**Externe Tester** (nur E-Mail, ohne ihn ins Team aufzunehmen): TestFlight → **Externe Tests** → Gruppe → Tester per E-Mail
→ Build hinzufügen. Der **erste** Build braucht dabei eine kurze Beta-Prüfung durch Apple (meist wenige Stunden bis 1 Tag).

## Neue Spielversion in die App bringen
Wenn das Spiel (`jj-la/`) geändert wurde, Claude sagen: „App aktualisieren“. Dann wird `ios/App/App/public/` neu befüllt
und die Build-Nummer erhöht. Danach am Mac nur **Product → Archive → Distribute** wiederholen.
(Selbst machen: in `jj-la/mobile/` `npm install` und `npm run sync`, in Xcode bei **General → Build** die Zahl um 1 erhöhen.)

## Häufige Fehler
- **„No account for team“ / Signing-Fehler** → Schritt 2 wiederholen, richtiges Team wählen.
- **„Archive“ ist grau** → oben ist ein Simulator ausgewählt; auf „Any iOS Device (arm64)“ umstellen.
- **Upload: „bundle version already used“** → General → **Build** um 1 erhöhen, neu archivieren.
- **Package-Fehler „capacitor-swift-pm“** → Menü File → Packages → **Reset Package Caches**, dann erneut.
- **Kein Ton** → einmal auf den Bildschirm tippen (iOS startet Ton erst nach Berührung); Stummschalter ist egal.
