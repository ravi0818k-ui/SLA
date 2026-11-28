/**
 * Super Learner Academy: free-registration leads -> Google Sheet  (2026-11-28)
 *
 * The website's "Book Free Seat" popup (lead-form.js, free mode only) sends every registration here.
 * This script writes one row per registration into the "Leads" tab of the Google Sheet it is attached to.
 *
 * SETUP (once, about 10 minutes):
 *  1. Create a new Google Sheet, name it "SLA Leads".
 *  2. Extensions -> Apps Script. Delete everything in Code.gs and paste this whole file. Save (Ctrl+S).
 *  3. In the toolbar pick the function "setup" and click Run. Allow the permissions it asks for
 *     (Advanced -> Go to project -> Allow; it is your own script). This creates the "Leads" tab with headers.
 *  4. Deploy -> New deployment -> gear icon -> Web app.
 *       Description: SLA leads v1      Execute as: Me      Who has access: Anyone
 *     Click Deploy and copy the Web app URL (ends with /exec). Send that URL to update data.json -> leadForm.endpoint.
 *  5. Test: open the /exec URL in a browser. It should show {"ok":true,"service":"SLA leads"}.
 *
 * CHANGING THIS SCRIPT LATER: Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy.
 * That keeps the same URL. ("New deployment" makes a NEW URL, and the website would still call the old one.)
 *
 * Load: Apps Script runs up to ~30 requests at the same moment and a sheet holds ~10 million cells
 * (about 450,000 rows of this sheet). A lock makes sure two registrations in the same second never overwrite each other.
 * Privacy: these are often students' phone numbers. Share the sheet only with the people who message leads.
 */

var SHEET_NAME = 'Leads';
var TIMEZONE = 'Asia/Kolkata';
// Optional: an email address that gets a short mail for every new registration (Gmail allows ~100 mails a day). Empty = off.
var NOTIFY_EMAIL = '';

var HEADERS = [
  'Registered (IST)', 'Who', 'Name', 'WhatsApp', 'Chat', 'Email', 'Class',
  'Status', 'Notes', 'Repeat?',
  'Page', 'Language', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'Referrer', 'Device', 'Lead ID'
];
var STATUS_OPTIONS = ['New', 'Messaged', 'Joined group', 'Attended', 'No reply', 'Not interested'];

/** Run once from the editor: creates the Leads tab, headers, formats and the Status dropdown. Safe to run again. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#3A5BFF').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  // Numbers and ids stay text (no scientific notation, no lost leading zeros).
  [col_('WhatsApp'), col_('gclid'), col_('fbclid'), col_('Lead ID')].forEach(function (c) {
    sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
  sh.getRange(2, col_('Status'), sh.getMaxRows() - 1, 1).setDataValidation(rule);
  var widths = { 'Registered (IST)': 140, 'Who': 80, 'Name': 170, 'WhatsApp': 115, 'Chat': 90, 'Email': 200, 'Class': 120,
    'Status': 120, 'Notes': 220, 'Repeat?': 70, 'Page': 220, 'Referrer': 200 };
  Object.keys(widths).forEach(function (h) { sh.setColumnWidth(col_(h), widths[h]); });
  var first = ss.getSheets()[0];
  if (first.getName() !== SHEET_NAME && first.getLastRow() === 0) ss.deleteSheet(first); // remove the empty "Sheet1"
  return 'Leads tab ready';
}

/** Opening the /exec URL in a browser: a quick "is it running?" check. */
function doGet() {
  return json_({ ok: true, service: 'SLA leads' });
}

/** The website posts one registration as JSON text. */
function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // hidden trap field: only bots fill it

    var name = clean_(d.name, 80);
    var phone = phone_(d.phone);
    if (!name || !phone) return json_({ ok: false, error: 'name and a 10-digit Indian mobile number are required' });

    var who = d.who === 'Parent' ? 'Parent' : (d.who === 'Student' ? 'Student' : clean_(d.who, 20));
    var email = clean_(d.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
    var id = clean_(d.leadId, 40) || Utilities.getUuid();

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = sheet_();
      var repeat = isRepeat_(sh, phone) ? 'Yes' : '';
      var row = {
        'Registered (IST)': Utilities.formatDate(new Date(), TIMEZONE, 'dd-MM-yyyy HH:mm'),
        'Who': who,
        'Name': name,
        'WhatsApp': phone,
        'Chat': '=HYPERLINK("https://wa.me/91' + phone + '","Open chat")',
        'Email': email,
        'Class': clean_(d.klass, 40),
        'Status': 'New',
        'Notes': '',
        'Repeat?': repeat,
        'Page': clean_(d.page, 200),
        'Language': clean_(d.lang, 20),
        'utm_source': clean_(d.utm_source, 100),
        'utm_medium': clean_(d.utm_medium, 100),
        'utm_campaign': clean_(d.utm_campaign, 150),
        'utm_term': clean_(d.utm_term, 150),
        'utm_content': clean_(d.utm_content, 150),
        'gclid': clean_(d.gclid, 200),
        'fbclid': clean_(d.fbclid, 200),
        'Referrer': clean_(d.referrer, 200),
        'Device': clean_(d.device, 20),
        'Lead ID': id
      };
      sh.appendRow(HEADERS.map(function (h) { return row[h] === undefined ? '' : row[h]; }));
    } finally {
      lock.releaseLock();
    }

    if (NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail(NOTIFY_EMAIL, 'New SLA registration: ' + name,
          who + ' · ' + name + ' · ' + phone + ' · ' + (d.klass || '') + '\nhttps://wa.me/91' + phone);
      } catch (mailErr) { /* mail quota reached: the row is saved anyway */ }
    }
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------- helpers ----------

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_NAME); }
  return sh;
}

function col_(header) {
  return HEADERS.indexOf(header) + 1;
}

/** True if this WhatsApp number registered before (handy for webinars: people register again for the next batch). */
function isRepeat_(sh, phone) {
  var last = sh.getLastRow();
  if (last < 2) return false;
  return !!sh.getRange(2, col_('WhatsApp'), last - 1, 1).createTextFinder(phone).matchEntireCell(true).findNext();
}

/** Trims, shortens and blocks spreadsheet formulas (a value starting with = + - @ is stored as plain text). */
function clean_(v, max) {
  var s = String(v === undefined || v === null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** "+91 98765-43210", "098765 43210", "9876543210" -> "9876543210". Anything else -> "". */
function phone_(v) {
  var digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
