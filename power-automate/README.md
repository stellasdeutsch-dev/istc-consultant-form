# Sending submissions to OneDrive

The site is static, so it cannot talk to OneDrive by itself: Microsoft Graph
needs an authenticated caller, and no secret can be shipped in public
JavaScript. Making applicants sign in with a Microsoft account is not an
option either — they are external experts.

The supported pattern is a **Power Automate flow with an HTTP trigger**. ISTC
owns the flow, the flow owns the OneDrive credentials, and the form only knows
a URL. Nothing sensitive lives in the browser.

```
  applicant → POST JSON → Power Automate (runs as an ISTC account) → OneDrive
                                                                   → Excel table
                                                                   → PDF
```

## What the form sends

One JSON body:

```jsonc
{
  "applicant": "Jane Doe",
  "baseName": "ISTC EOI — Jane Doe",
  "submittedAt": "2026-08-10T12:00:00.000Z",

  "answers": [ { "id": "fullName", "title": "Full Name", "value": "Jane Doe" } ],
  "raw":     { "fullName": "Jane Doe" },

  "documents": {
    "xlsx": { "name": "…xlsx", "data": "<base64 of a ready .xlsx>" },
    "html": { "name": "…html", "data": "<the application as HTML>" }
  },

  "files": {
    "cv": { "name": "cv.pdf", "type": "application/pdf", "size": 12345, "data": "<base64>" }
  }
}
```

`documents.xlsx` is a complete workbook built in the browser, and
`documents.html` is the same application laid out for print. You do not have to
generate either one in the flow — but converting the HTML is how you get a PDF
with correct fonts for non-Latin answers.

## Building the flow

1. **Power Automate → Create → Instant cloud flow → When an HTTP request is
   received.** Save once, then copy the generated **HTTP POST URL**.
2. Paste that URL into `CONFIG.SUBMIT_URL` at the top of [`app.js`](../app.js),
   commit, and bump the `?v=` token in `index.html`.
3. Add these actions:

| Purpose | Action | Key settings |
| --- | --- | --- |
| Folder per applicant | **OneDrive for Business → Create folder** | Folder path `/ISTC Consultant Database`, name `@{triggerBody()?['baseName']}` |
| The workbook | **Create file** | Name `@{triggerBody()?['documents']?['xlsx']?['name']}`, content `@{base64ToBinary(triggerBody()?['documents']?['xlsx']?['data'])}` |
| Source for the PDF | **Create file** | Name `application.html`, content `@{triggerBody()?['documents']?['html']?['data']}` |
| The PDF | **Convert file** → then **Create file** | Convert the HTML file created above to PDF, save as `@{triggerBody()?['baseName']}.pdf` |
| CV and attachments | **Apply to each** over `@{triggerBody()?['files']}` → **Create file** | Name `@{items('Apply_to_each')?['name']}`, content `@{base64ToBinary(items('Apply_to_each')?['data'])}` |
| Master spreadsheet | **Excel Online (Business) → Add a row into a table** | Point at one workbook with a named table; map columns from `answers` |
| Reply to the form | **Response** | Status `200`, body `{"ok": true}` |

The form treats a non-2xx response, or a body containing `"ok": false`, as a
failure and tells the applicant to try again — so keep the **Response** action
last.

### Notes

- **Enable CORS.** In the trigger's advanced settings, allow the origin
  `https://<your-org>.github.io`. Without it the browser blocks the POST.
  The form deliberately sends no `Content-Type` header so the request stays a
  "simple" one and skips the preflight.
- **Size.** Attachments are base64, which adds ~33%. With a 10 MB CV a body can
  approach 15 MB; Power Automate's HTTP trigger accepts up to 100 MB, so this
  is fine, but do not raise the per-file limit much further.
- **Anyone with the URL can post to it.** The URL contains a signature and is
  effectively a secret — keep it out of public documents. Because it lives in
  `app.js`, which is public, treat the endpoint as write-only and unauthenticated:
  it should only ever append data, never return any.

## Alternative: Google Workspace

If ISTC would rather stay on Google, [`apps-script/Code.gs`](../apps-script/Code.gs)
does the same job with Sheets and Drive and needs no Microsoft licence. Both
accept the identical payload — set `CONFIG.SUBMIT_URL` to whichever you deploy.
