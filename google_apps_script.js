/**
 * IT Helpdesk CRM - Google Sheets 2-Way Sync (Advanced Governance Edition)
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet -> Click "Extensions" -> "Apps Script"
 * 2. Delete all existing code and paste this entire script.
 * 3. Update the SUPABASE_URL and SUPABASE_ANON_KEY below.
 * 4. Create two sheets in your workbook: "Tickets" and "Asset Audits".
 */

const SUPABASE_URL = "https://nixubrappucqeusjtome.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peHVicmFwcHVjcWV1c2p0b21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mjc3MjQsImV4cCI6MjA5MjUwMzcyNH0.Xt_amvs5Rcb5T6jvAolaIQFGu2XSW2-5wyp4y0zTBTk";
const ADMIN_EMAIL = "mayanksaxena@elitemindz.co";

/**
 * 1. MULTI-TYPE WEBHOOK (Receives data from the React app)
 */
function doPost(e) {
  try {
    console.log("Payload received:", e.postData.contents);
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ROUTE 1: TICKET SYNCHRONIZATION
    if (payload.type === 'ticket' || !payload.type) {
      console.log("Routing to Tickets sheet...");
      const sheet = ss.getSheetByName("Tickets") || ss.getSheets()[0];

      const newRow = [
        new Date(),
        payload.name || "N/A",
        payload.email || "N/A",
        payload.department || "General",
        payload.title || "Untitled Issue",
        payload.description || "No description",
        payload.issue_type || "Other",
        payload.priority || "Medium",
        payload.is_blocked ? "Yes" : "No",
        payload.issue_start_date || "",
        payload.frequency || "One-Time",
        payload.attachment || "",
        "", // Column 13
        payload.sub_type || "General"
      ];
      sheet.appendRow(newRow);

      // Detailed Email Notification for Software Tickets
      sendDetailedEmail("IT Helpdesk CRM Software", payload);

      return successResponse("Ticket synchronized to Google Sheet");
    }

    // ROUTE 2: ASSET AUDIT SYNCHRONIZATION
    if (payload.type === 'audit') {
      const sheet = ss.getSheetByName("Asset Audits") || ss.insertSheet("Asset Audits");

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Timestamp", "Asset Name", "Serial ID", "Action", "Auditor", "Remarks"]);
      }

      const newRow = [
        new Date(),
        payload.asset_name,
        payload.asset_id,
        payload.action,
        payload.performer,
        payload.remarks
      ];
      sheet.appendRow(newRow);
      return successResponse("Asset Audit synchronized to Google Sheet");
    }

    // ROUTE 3: SLA BREACH NOTIFICATION
    if (payload.type === 'sla_breach') {
      sendSlaBreachEmail(payload);
      return successResponse("SLA Breach notification sent");
    }

  } catch (error) {
    return errorResponse(error.toString());
  }
}

/**
 * SLA Breach Email Helper
 */
function sendSlaBreachEmail(data) {
  const subject = "⚠️ SLA BREACH ALERT: Ticket #" + (data.id?.substring(0, 8) || "N/A");
  const body = "IMPORTANT: An SLA breach has been detected.\n\n" +
               "Ticket ID: #" + data.id + "\n" +
               "Title: " + data.title + "\n" +
               "Requester: " + (data.name || "N/A") + "\n" +
               "Priority: " + data.priority + "\n" +
               "SLA Deadline: " + data.sla_deadline + "\n\n" +
               "Please resolve this ticket immediately to prevent further delays.\n" +
               "View Ticket: " + (data.app_url || "CRM Dashboard");

  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
}

/**
 * Scheduled SLA Check (To be run via Trigger every hour)
 */
function scheduledSlaCheck() {
  const now = new Date().toISOString();
  const url = SUPABASE_URL + "/rest/v1/tickets?select=*,profiles!employee_id(name)&sla_deadline=lt." + now + "&sla_breached=eq.false&status=not.in.(\"Resolved\",\"Closed\")";
  
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY
  };

  const response = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });
  
  if (response.getResponseCode() === 200) {
    const breachedTickets = JSON.parse(response.getContentText());
    console.log("Found " + breachedTickets.length + " breached tickets.");

    breachedTickets.forEach(ticket => {
      // 1. Send Email
      sendSlaBreachEmail({
        id: ticket.id,
        title: ticket.title,
        name: ticket.profiles?.name || "N/A",
        priority: ticket.priority,
        sla_deadline: ticket.sla_deadline
      });

      // 2. Mark as Breached in Supabase
      const updateUrl = SUPABASE_URL + "/rest/v1/tickets?id=eq." + ticket.id;
      UrlFetchApp.fetch(updateUrl, {
        method: "patch",
        headers: headers,
        payload: JSON.stringify({ sla_breached: true }),
        muteHttpExceptions: true
      });
      
      console.log("Notified and updated ticket: " + ticket.id);
    });
  } else {
    console.error("Error fetching breached tickets: " + response.getContentText());
  }
}

/**
 * Detailed Email Notification Helper
 */
function sendDetailedEmail(source, data) {
  const isBlockedText = (typeof data.is_blocked === 'boolean')
    ? (data.is_blocked ? "Yes" : "No")
    : (data.is_blocked && data.is_blocked.toString().toLowerCase().includes('yes') ? "Yes" : "No");

  const body = "A new ticket has been raised via the " + source + ".\n\n" +
               "User: " + (data.name || "N/A") + " (" + (data.email || "N/A") + ")\n" +
               "Department: " + (data.department || "N/A") + "\n\n" +
               "Issue: " + (data.title || "Untitled Issue") + "\n" +
               "Type: " + (data.issue_type || "Other") + " (" + (data.sub_type || "General") + ")\n" +
               "Priority: " + (data.priority || "Medium") + "\n" +
               "Blocked: " + isBlockedText + "\n" +
               "Frequency: " + (data.frequency || "One-Time") + "\n" +
               "Start Date: " + (data.issue_start_date || "N/A") + "\n" +
               "Attachment: " + (data.attachment || "None") + "\n\n" +
               "Description: " + (data.description || "No description provided") + "\n\n" +
               "Please log in to the CRM to assign and resolve this ticket.";

  MailApp.sendEmail(ADMIN_EMAIL, "[New Ticket] " + data.priority + " Priority: " + data.title, body);
}

function successResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 2. SHEET -> SYSTEM (Triggers when a Google Form is submitted)
 */
function onFormSubmit(e) {
  try {
    const rawResponses = e.namedValues;
    const responses = {};
    Object.keys(rawResponses).forEach(key => {
      responses[key.trim()] = rawResponses[key];
    });

    const name = (responses["Full Name"] || responses["Name"] || ["N/A"])[0];
    const email = (responses["Email Address"] || responses["Email"] || ["N/A"])[0];
    const department = (responses["Department"] || ["General"])[0];
    const title = (responses["Issue Title"] || responses["Title"] || ["Untitled Issue"])[0];
    const description = (responses["Describe the Issue"] || responses["Description"] || [""])[0];
    const issueType = (responses["Issue Type"] || responses["Category"] || ["Other"])[0];
    const priority = (responses["Priority/Impact"] || responses["Priority"] || ["Medium"])[0];
    const isBlockedRaw = (responses["Is your work completely blocked?"] || ["No"])[0];
    const isBlocked = isBlockedRaw.toLowerCase() === 'yes';
    const startDate = (responses["When did this issue start?"] || [""])[0];
    const frequency = (responses["Frequency of issue"] || ["One-Time"])[0];
    const attachment = (responses["Attachment"] || [""])[0];
    const subType = (responses["Sub-Type"] || ["General"])[0];

    const data = {
      name, email, department, title, description,
      issue_type: issueType,
      sub_type: subType,
      priority,
      is_blocked: isBlocked,
      issue_start_date: startDate,
      frequency,
      attachment
    };

    // Send Detailed Notification
    sendDetailedEmail("IT Helpdesk Google Form", data);

    pushToSupabase(email, name, department, title, description, issueType, subType, priority, isBlocked, startDate, frequency);
  } catch (error) {
    console.error("onFormSubmit Error:", error.toString());
  }
}

function pushToSupabase(email, name, department, title, description, issueType, subType, priority, isBlocked, startDate, frequency) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };

  let formattedDate = null;
  if (startDate && startDate.trim() !== "") {
    try {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("Invalid date received:", startDate);
    }
  }

  const getUrl = SUPABASE_URL + "/rest/v1/profiles?select=id&email=eq." + encodeURIComponent(email);
  const getResponse = UrlFetchApp.fetch(getUrl, { method: "get", headers: headers, muteHttpExceptions: true });

  let employeeId = null;
  if (getResponse.getResponseCode() === 200) {
    const data = JSON.parse(getResponse.getContentText());
    if (data && data.length > 0) employeeId = data[0].id;
  }

  const insertUrl = SUPABASE_URL + "/rest/v1/tickets";
  const ticketData = {
    title: title,
    description: description,
    issue_type: issueType,
    sub_type: subType || "General",
    priority: priority,
    status: "Open",
    employee_id: employeeId || null,
    guest_name: !employeeId ? name : null,
    guest_email: !employeeId ? email : null,
    department: department,
    is_blocked: isBlocked,
    frequency: frequency,
    issue_start_date: formattedDate
  };

  const insertResponse = UrlFetchApp.fetch(insertUrl, {
    method: "post",
    headers: headers,
    payload: JSON.stringify(ticketData),
    muteHttpExceptions: true
  });
}
