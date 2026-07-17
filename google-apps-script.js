/**
 * Google Apps Script — SLA Website Content API
 * 
 * PURPOSE:
 * Serves website content (title, registration details, pricing, 
 * payment link, and 3-day curriculum) from a Google Sheet as a JSON API.
 * 
 * SETUP:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code in Code.gs
 * 4. Paste this entire script
 * 5. Click Deploy → New Deployment
 * 6. Select Type: "Web app"
 * 7. Set "Execute as": Me
 * 8. Set "Who has access": Anyone
 * 9. Click Deploy and copy the Web App URL
 * 10. Use that URL in your website's fetch call
 */

/**
 * Handles GET requests to the web app.
 * Reads data from the active spreadsheet and returns it as JSON.
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getRange(2, 1, 1, 13).getValues()[0]; // Row 2, Columns A-M

    var response = {
      "status": "success",
      "lastUpdated": new Date().toISOString(),
      "content": {
        "pageTitle": data[0] || "Become a Super Learner in Just 3 Days",
        "registration": {
          "closeDate": data[1] || "",
          "buttonText": data[2] || "Register Now",
          "price": data[3] ? String(data[3]) : "455",
          "originalPrice": data[4] ? String(data[4]) : "4999",
          "currency": data[5] || "₹",
          "paymentLink": data[6] || "#"
        },
        "curriculum": {
          "day1": {
            "title": data[7] || "Memory & Learning Mastery",
            "points": parsePoints(data[8])
          },
          "day2": {
            "title": data[9] || "Focus & Performance",
            "points": parsePoints(data[10])
          },
          "day3": {
            "title": data[11] || "Discovery & Rewards",
            "points": parsePoints(data[12])
          }
        }
      }
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        "status": "error",
        "message": error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Parses a comma-separated string into an array of trimmed points.
 * Returns a default array if input is empty.
 */
function parsePoints(pointsString) {
  if (!pointsString || String(pointsString).trim() === "") {
    return [];
  }
  return String(pointsString)
    .split(",")
    .map(function(point) {
      return point.trim();
    })
    .filter(function(point) {
      return point.length > 0;
    });
}

/**
 * Optional: Test function to verify output in Apps Script editor.
 * Run this from the editor to see what JSON will be served.
 */
function testOutput() {
  var result = doGet();
  Logger.log(result.getContent());
}
