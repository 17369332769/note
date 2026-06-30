# Sheet Cleanup Toolkit

This plugin is a Google Workspace add-on template for spreadsheet cleanup actions.

## Structure

- `appscript/appsscript.json` configures the Workspace Add-on manifest.
- `appscript/Code.gs` builds the card UI and spreadsheet action handlers.
- The public marketing/documentation page is generated from `lib/plugins.ts` at `/plugins/sheet-cleanup`.

## Local Apps Script workflow

```powershell
cd plugins/sheet-cleanup/appscript
npx clasp login
npx clasp create --type standalone --title "Sheet Cleanup Toolkit"
npx clasp push
```
