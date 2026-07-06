# TestFlight Upload Setup

## One-Time Setup

### 1. Generate App-specific Password

1. Gehe zu https://appleid.apple.com/
2. Sign in mit deiner Apple ID
3. **Security** → **App-Specific Passwords** → **Generate Password**
4. Name: `Meteoblick CI`
5. Kopiere das Passwort (Format: `abcd-efgh-ijkl-mnop`)

### 2. Store in macOS Keychain

```bash
security add-generic-password \
  -a "simon.balz@mac.com" \
  -s "AC_PASSWORD" \
  -w "DEIN-APP-SPEZIFISCHES-PASSWORT"
```

Verify:
```bash
security find-generic-password -s "AC_PASSWORD" -w
```

### 3. Alternative: Use Environment Variable

```bash
# Add to ~/.zshrc or ~/.bash_profile:
export TESTFLIGHT_PASSWORD="dein-passwort-hier"

# Or inline for one-time use:
TESTFLIGHT_PASSWORD="dein-passwort-hier" pnpm ios:upload
```

## Usage

### Build Archive
```bash
pnpm ios:archive
```

This will:
- Increment build number
- Build archive
- Copy to Xcode Organizer location with timestamp

### Upload to TestFlight
```bash
pnpm ios:upload
```

Or one-shot:
```bash
pnpm ios:archive && pnpm ios:upload
```

## Troubleshooting

### "Authentication Failure"
- Regenerate App-specific password
- Re-add to keychain

### "Archive not found"
- Run `pnpm ios:archive` first
- Check Xcode → Window → Organizer

### "Export failed"
- Check `ios/ExportOptions.plist` exists
- Verify `teamID: YE6GEBK456`

## Security Notes

⚠️ **Never commit App-specific passwords to git!**
⚠️ **Never share screenshots showing the password**
⚠️ **Use keychain for local development**
⚠️ **For CI/CD (GitHub Actions, etc.), use encrypted secrets**