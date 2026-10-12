# Publishing to the VS Code Marketplace

This extension is ready to package and publish, but **two steps require a human
with Marketplace access** — the extension repository cannot do them for you.

## What is already done

- `package.json` has `name`, `displayName`, `version`, `engines.vscode`,
  `categories`, `icon` (256×256 PNG), `license`, `repository`, `homepage`,
  `bugs`, `keywords`, `pricing`.
- `LICENSE`, `README.md`, `CHANGELOG.md` exist at the repository root.
- The extension builds to `out/extension.js` and packages to a `.vsix`.

## What you must do

### 1. Create a Publisher and fix the placeholder

`package.json` currently uses a **placeholder** publisher:

```json
"publisher": "botbridge"
```

1. Go to <https://marketplace.visualstudio.com/manage> and sign in.
2. Click **Create publisher**. Pick a unique **ID** (it appears in the extension
   URL and cannot be changed later) and a display **Name**.
3. Replace `"publisher": "botbridge"` in `package.json` with your real
   publisher **ID**, then commit the change.

### 2. Create an Azure DevOps Personal Access Token (PAT)

1. Sign in at <https://dev.azure.com> with the **same** Microsoft account.
2. **User settings → Personal access tokens → New Token**.
3. **Organization:** *All accessible organizations*.
4. **Scopes:** *Custom defined* → **Marketplace → Manage**.
5. Copy the token (it is shown once).

> Note: Azure DevOps global PATs are scheduled for retirement on **2026-12-01**.
> After that, use Microsoft Entra ID with `vsce publish --azure-credential`
> (requires vsce ≥ 2.26.1) and add the identity to your publisher as a
> **Contributor**.

### 3. Log in, package and publish

```bash
# once per machine
npx @vscode/vsce login <publisher-id>     # paste the PAT when prompted

# from the repository root
npm install
npx @vscode/vsce package                  # builds botbridge-webcam-0.1.0.vsix
npx @vscode/vsce publish                  # uploads the current version
```

`vsce publish minor` / `vsce publish 1.1.0` bump the version for you.

## Reviewer checklist

Before uploading, confirm:

- [ ] `publisher` in `package.json` matches a real, existing publisher **ID**.
- [ ] `version` is greater than the last published version.
- [ ] The icon is a PNG ≥128×128 (this repo uses 256×256).
- [ ] `README.md` links are `https` and contain no SVG images.
- [ ] `keywords` has ≤30 entries.
- [ ] `npm run compile` succeeds and `out/extension.js` exists before packaging.

## What this repository deliberately does **not** do

- It does not push to `main`/`master` on your behalf.
- It does not create publishers, tokens, or Marketplace listings.
- It does not upload, submit for review, or publish anything.

Those are user actions, by design.
