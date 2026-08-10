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

var HEADERS = [
  'Timestamp',
  'Role',
  'Legal Status',
  'Organization',
  'Full Name / Contact Person',
  'Nationality',
  'Country of Residence',
  'Email',
  'Phone',
  'Areas of Expertise',
  'Other Expertise',
  'Years of Experience',
  'Geographic Experience',
  'Other Region',
  'Languages',
  'Summary of Expertise',
  'Key Assignments',
  'Availability',
  'Daily Rate (EUR)',
  'Hourly Rate (EUR)',
  'Previous Work with ISTC',
  'Reference Number',
  'Conflict of Interest Agreed',
  'Data Protection Agreed',
  'CV',
  'Certifications',
  'Publications',
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Minimal server-side sanity checks
    if (!data.fullName || !data.email) {
      return jsonResponse({ ok: false, error: 'Missing required fields.' });
    }

    var fileLinks = saveFiles(data);
    appendRow(data, fileLinks);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function saveFiles(data) {
  var links = { cv: '', certifications: '', publications: '' };
  var files = data.files || {};
  var hasAny = ['cv', 'certifications', 'publications'].some(function (k) {
    return files[k] && files[k].data;
  });
  if (!hasAny) return links;

  var root = getOrCreateFolder(FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HHmm');
  var sub = root.createFolder((data.fullName || 'Applicant') + ' — ' + stamp);

  ['cv', 'certifications', 'publications'].forEach(function (key) {
    var f = files[key];
    if (f && f.data) {
      var blob = Utilities.newBlob(
        Utilities.base64Decode(f.data),
        f.type || 'application/octet-stream',
        f.name || key
      );
      links[key] = sub.createFile(blob).getUrl();
    }
  });

  return links;
}

function appendRow(data, fileLinks) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    data.role || '',
    data.legalStatus || '',
    data.orgName || '',
    data.fullName || '',
    data.nationality || '',
    data.countryResidence || '',
    data.email || '',
    data.phone || '',
    (data.expertise || []).join(', '),
    data.expertiseOther || '',
    data.experience || '',
    (data.geography || []).join(', '),
    data.geographyOther || '',
    data.languages || '',
    data.summary || '',
    data.assignments || '',
    (data.availability || []).join(', '),
    data.dailyRate || '',
    data.hourlyRate || '',
    data.previousWork || '',
    data.referenceNumber || '',
    data.conflictAgree ? 'Yes' : 'No',
    data.dataAgree ? 'Yes' : 'No',
    fileLinks.cv,
    fileLinks.certifications,
    fileLinks.publications,
  ]);
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
