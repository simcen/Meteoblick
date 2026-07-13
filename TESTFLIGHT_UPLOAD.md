# TestFlight Upload Setup

Uses `xcrun iTMSTransporter` (Apple's first-party uploader, bundled with
Xcode 16+) with App Store Connect API key (.p8) authentication. Replaces
the old `xcrun altool` + app-specific-password setup which was deprecated.

## One-Time Setup

### 1. Generate App Store Connect API key

1. Gehe zu https://appstoreconnect.apple.com/access/api
2. **Generate API Key** (Team Keys tab)
3. Name: z.B. `Meteoblick — TestFlight Upload`
4. Access: **App Manager** (nur diese Rolle darf Builds hochladen)
5. Notiere dir die drei Werte, die Apple **nur einmal** zeigt:
   - **Key ID** (10 Zeichen, z.B. `JV2T936XNJ`)
   - **Issuer ID** (UUID, z.B. `69a6de6f-1a11-47e3-e053-5b8c7c11a4d1`)
   - **.p8 file** — Download SOFORT, Apple zeigt es nie wieder

### 2. Store the .p8 file safely

Empfohlen: ausserhalb vom Repo, z.B. `~/Documents/AuthKey_XXXXXXXXXX.p8`.
Nie ins Repo committen — `.gitignore` enthält aber bereits `*.p8`-ähnliche
Muster. Prüfen:

```bash
git check-ignore /path/to/AuthKey_XXXXXXXXXX.p8
```

#### Wichtig: `.p8`-Dateinamen-Convention

`iTMSTransporter` sucht das `.p8` **nicht** über einen CLI-Flag, sondern
per Dateinamen-Pattern `AuthKey_<KEY_ID>.p8` in **ausschliesslich diesen
vier Pfaden** (in dieser Reihenfolge):

- `./private_keys/`
- `~/private_keys/`
- `~/.private_keys/`
- `~/.appstoreconnect/private_keys/`

`TRANSPORTER_HOME` ist **kein** Search-Pfad — Apple's ältere Docs waren da
missverständlich, das aktuelle Verhalten ist fix auf diese 4 Pfade beschränkt.

Liegt das `.p8` woanders (z.B. `~/Documents/AuthKey_XXX.p8`), legt das
Script beim Upload automatisch einen Symlink in `~/private_keys/` an,
der auf dein Original-File zeigt. Die Datei muss also **nicht** verschoben
werden, nur der Dateiname muss exakt `AuthKey_<KEY_ID>.p8` lauten.

### 3. Set env vars

In `~/.zshrc` (oder `~/.bash_profile`):

```bash
export ASC_API_KEY_PATH="/Users/simcen/Documents/AuthKey_JV2T936XNJ.p8"
export ASC_API_KEY_ID="JV2T936XNJ"
export ASC_API_ISSUER_ID="69a6de6f-1a11-47e3-e053-5b8c7c11a4d1"
```

Quelle reload:

```bash
source ~/.zshrc
```

Die Defaults in `scripts/upload-testflight.sh` enthalten bereits Werte für
dieses Projekt, sodass das Script auch ohne env vars funktioniert. Für CI/CD
sollten die env vars gesetzt sein.

### 4. Drop the old App-Specific-Password keychain entry

Wenn du den alten altool-Pfad nicht mehr brauchst:

```bash
security delete-generic-password -s "AC_PASSWORD"
```

## Usage

### One-shot: archive + upload

```bash
pnpm ios:archive && pnpm ios:upload
```

### Two-shot

```bash
pnpm ios:archive     # builds ios/build/Meteoblick.xcarchive
pnpm ios:upload      # exports to IPA + uploads to TestFlight
```

### Upload an existing archive by path

```bash
./scripts/upload-testflight.sh path/to/Meteoblick.xcarchive
```

## How it works

1. **`xcodebuild archive`** (in `scripts/archive-ios.sh`) → `ios/build/Meteoblick.xcarchive`
2. **`xcodebuild -exportArchive`** (in upload script) → `ios/build/export/Meteoblick.ipa`
   using `ios/ExportOptions.plist`
3. **`xcrun iTMSTransporter -m upload`** → App Store Connect → TestFlight

`ios/ExportOptions.plist` no longer has `teamID` — the API key's Issuer ID
binds the team automatically. This removes the "wrong team" failure mode
that caused the previous altool workflow to need manual team selection.

## Troubleshooting

### "Could not find API key"
- Check `ASC_API_KEY_PATH` env var or the hardcoded fallback
- Verify the file still exists: `ls -la "$ASC_API_KEY_PATH"`

### "Authentication failed"
- Verify `ASC_API_KEY_ID` matches the Key ID on App Store Connect
- Verify `ASC_API_ISSUER_ID` matches the Issuer ID
- Make sure the API key has the **App Manager** role
- If you regenerated the key, the old .p8 is invalid — re-download

### "Archive not found"
- Run `pnpm ios:archive` first
- Or pass the archive path explicitly: `./scripts/upload-testflight.sh path/to/archive.xcarchive`

### "Export failed"
- `ios/ExportOptions.plist` valid? (no teamID needed anymore)
- Signing setup in Xcode OK? (Open Xcode → Fix signing → Re-archive)
- Run `xcodebuild -exportArchive` manually with `-verbose` to see details

### iTMSTransporter debug
```bash
xcrun iTMSTransporter -m verify -f Meteoblick.ipa \
  -k "$ASC_API_KEY_ID" -i "$ASC_API_KEY_PATH" -u "$ASC_API_ISSUER_ID" -v verbose
```

## Security Notes

⚠️ **Never commit the .p8 file to git!**
⚠️ **Never share screenshots showing the full Key ID + Issuer + .p8 path together**
⚠️ **For CI/CD, store the .p8 as an encrypted secret, not in plaintext env**
⚠️ **Rotate the API key annually** (delete on App Store Connect, regenerate)

## Why we migrated off altool

- `altool` deprecated by Apple for notarization (Xcode 13) — same code path
  for iOS TestFlight uploads
- App-specific passwords are fragile: 2FA sync issues, password rotation
- `iTMSTransporter` is the actual backend Transporter.app uses — direct,
  no third-party dependency, no Ruby
- API key (.p8) auth removes the "wrong team" failure mode (Issuer binds
  team automatically, no manual team selection needed)

References:
- [TN3147: Migrating to the latest notarization tool](https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool)
- [Transporter User Guide](https://help.apple.com/itc/transporteruserguide/en.lproj/static.html)
- [Creating API Keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)
