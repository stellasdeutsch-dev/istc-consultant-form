/**
 * ISTC Consultant Database — submission backend (Google Apps Script)
 *
 * Receives JSON submissions from the GitHub Pages form, stores uploaded
 * files in Google Drive, and appends one row per application to the
 * spreadsheet this script is bound to.
 *
 * SETUP (one time, ~5 minutes):
 *  1. Create a new Google Sheet (this will hold the responses).
 *  2. In the Sheet: Extensions → Apps Script. Delete the sample code and
 *     paste this entire file.
 *  3. Click Deploy → New deployment → type "Web app".
 *       - Execute as:        Me
 *       - Who has access:    Anyone
 *  4. Authorize when prompted, then copy the Web app URL
 *     (looks like https://script.google.com/macros/s/XXXX/exec).
 *  5. In app.js on the website, set CONFIG.SUBMIT_URL to that URL,
 *     commit, and push.
 *
 * Uploaded files are stored in a Drive folder named FOLDER_NAME, one
 * subfolder per applicant, and linked from the sheet.
 */

var FOLDER_NAME = 'ISTC Consultant Database — Uploads';
var SHEET_NAME = 'Applications';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (!data.answers || !data.answers.length) {
      return jsonResponse({ ok: false, error: 'Empty submission.' });
    }

    var fileLinks = saveFiles(data);
    appendDynamicRow(data, fileLinks);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * The form is schema-driven, so its questions can change in admin.html
 * without touching this script. Columns are therefore derived from the
 * submission itself: existing headers are reused, and any question we
 * have not seen before is appended as a new column.
 */
function appendDynamicRow(data, fileLinks) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var headers = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0]
    : [];
  if (!headers.length || !headers[0]) headers = ['Timestamp'];

  var row = {};
  row['Timestamp'] = new Date();

  (data.answers || []).forEach(function (a) {
    row[a.title || a.id] = a.value;
  });

  Object.keys(fileLinks).forEach(function (key) {
    if (fileLinks[key]) row['File: ' + key] = fileLinks[key];
  });

  // Grow the header row with any newly added questions
  Object.keys(row).forEach(function (name) {
    if (headers.indexOf(name) === -1) headers.push(name);
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  var values = headers.map(function (name) {
    return row[name] === undefined ? '' : row[name];
  });
  sheet.appendRow(values);
}

function saveFiles(data) {
  var links = {};
  var files = data.files || {};
  var keys = Object.keys(files).filter(function (k) { return files[k] && files[k].data; });
  if (!keys.length) return links;

  var root = getOrCreateFolder(FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HHmm');
  var sub = root.createFolder(applicantName(data) + ' — ' + stamp);

  keys.forEach(function (key) {
    var f = files[key];
    var blob = Utilities.newBlob(
      Utilities.base64Decode(f.data),
      f.type || 'application/octet-stream',
      f.name || key
    );
    links[key] = sub.createFile(blob).getUrl();
  });

  return links;
}

function getOrCreateFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** Best-effort label for the Drive subfolder, whatever the schema calls it. */
function applicantName(data) {
  var answers = data.answers || [];
  for (var i = 0; i < answers.length; i++) {
    var t = String(answers[i].title || '').toLowerCase();
    if (t.indexOf('name') !== -1 && answers[i].value) return String(answers[i].value).slice(0, 60);
  }
  return 'Applicant';
}
