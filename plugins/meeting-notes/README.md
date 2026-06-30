# Meeting Notes Assistant

This plugin is a Google Workspace add-on template for creating structured meeting notes from Calendar events.

## Structure

- `appscript/appsscript.json` configures the Workspace Add-on manifest.
- `appscript/Code.gs` builds the card UI and action handlers with Apps Script CardService.
- The public marketing/documentation page is generated from `lib/plugins.ts` at `/plugins/meeting-notes`.

## Local Apps Script workflow

```powershell
cd plugins/meeting-notes/appscript
npx clasp login
npx clasp create --type standalone --title "Meeting Notes Assistant"
npx clasp push
```
