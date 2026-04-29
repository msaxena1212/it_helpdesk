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

      const ticketId = payload.id || "";
      const isAnonymousGrievance = (payload.sub_type === 'Grievance' && payload.custom_fields && payload.custom_fields.anonymous);
      
      const requesterName = isAnonymousGrievance ? "ANONYMOUS" : (payload.name || "N/A");
      const requesterEmail = isAnonymousGrievance ? "HIDDEN" : (payload.email || "N/A");

      const newRow = [
        new Date(),
        requesterName,
        requesterEmail,
        payload.department || "General",
        payload.title || "Untitled Issue",
        payload.description || "No description",
        payload.issue_type || "Other",
        payload.priority || "Medium",
        payload.is_blocked ? "Yes" : "No",
        payload.issue_start_date || "",
        payload.frequency || "One-Time",
        payload.attachment || "",
        "Open", // Default Status
        payload.sub_type || "General",
        ticketId
      ];

      // DEDUPLICATION: Check if Ticket ID already exists
      const idColumn = 15;
      const data = sheet.getDataRange().getValues();
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][idColumn - 1] === ticketId && ticketId !== "") {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > -1) {
        // Update existing row instead of appending
        sheet.getRange(foundRow, 1, 1, newRow.length).setValues([newRow]);
      } else {
        sheet.appendRow(newRow);
      }

      // Detailed Email Notification
      sendDetailedEmail("IT Helpdesk CRM", payload);

      return successResponse("Ticket synchronized to Google Sheet");
    }

    // ROUTE 6: UPDATE TICKET (From CRM to Sheet)
    if (payload.type === 'update') {
      const ticketId = payload.id;
      if (!ticketId) return errorResponse("Missing Ticket ID for update");

      const data = sheet.getDataRange().getValues();
      const idColumn = 15;
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][idColumn - 1] === ticketId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > -1) {
        if (payload.status) {
          sheet.getRange(foundRow, 13).setValue(payload.status);
        }
        if (payload.assigned_to_name) {
          // If we want to store assigned admin, we need a column.
          // Let's add it to Column 16 if not exists.
          sheet.getRange(foundRow, 16).setValue(payload.assigned_to_name);
        }
        return successResponse("Ticket updated in Google Sheet");
      }
      return errorResponse("Ticket ID not found in sheet");
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

    // ROUTE 4: L2 ESCALATION (Senior Management)
    if (payload.type === 'escalation_l2') {
      sendL2EscalationEmail(payload);
      return successResponse("L2 Escalation notification sent");
    }

    // ROUTE 5: CALENDAR EVENT REMINDERS
    if (payload.type === 'calendar_event' || payload.type === 'subscription_reminder') {
      return createCalendarEvent(payload);
    }

  } catch (error) {
    return errorResponse(error.toString());
  }
}

/**
 * Creates an event in the user's primary Google Calendar
 */
function createCalendarEvent(data) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const startTime = new Date(data.date);
    
    // Default to 1-hour event if no end time
    const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); 
    
    const event = calendar.createEvent(
      data.title,
      startTime,
      endTime,
      { description: data.description || "System generated reminder from Zyno CRM." }
    );
    
    console.log("Calendar event created: " + event.getId());
    return successResponse("Calendar reminder created successfully");
  } catch (e) {
    console.error("Calendar Error:", e.toString());
    return errorResponse("Failed to create calendar event: " + e.toString());
  }
}

/**
 * L2 Escalation Email Helper (Senior Management)
 */
function sendL2EscalationEmail(data) {
  const subject = "🚨 CRITICAL ESCALATION: Ticket #" + (data.id?.substring(0, 8) || "N/A") + " remains unresolved!";
  const body = "SENIOR MANAGEMENT ALERT: A ticket has reached Level 2 Escalation (4+ hours post-SLA breach).\n\n" +
               "Ticket ID: #" + data.id + "\n" +
               "Title: " + data.title + "\n" +
               "Requester: " + (data.name || "N/A") + "\n" +
               "Hours Overdue: " + (data.breach_age || "4+") + " hours\n\n" +
               "Immediate intervention is required.\n" +
               "View Details: " + (data.app_url || "CRM Dashboard");

  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
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

  const subType = data.sub_type || "General";
  let subject = "[New Ticket] " + data.priority + " Priority: " + data.title;
  let intro = "A new ticket has been raised via the " + source + ".\n\n";
  let requesterName = data.name || "N/A";
  let requesterEmail = data.email || "N/A";

  // Specialized Logic for Grievance (Confidentiality)
  if (subType === 'Grievance') {
    subject = "🚨 [CONFIDENTIAL GRIEVANCE] Urgent Attention Required";
    intro = "SECURITY ALERT: A confidential grievance has been submitted.\n\n";
    if (data.custom_fields && data.custom_fields.anonymous) {
      requesterName = "ANONYMOUS";
      requesterEmail = "HIDDEN";
    }
  } else if (subType === 'Payslip') {
    subject = "💰 [PAYROLL REQUEST] Monthly Payslip Generation";
  }

  const body = intro +
               "User: " + requesterName + " (" + requesterEmail + ")\n" +
               "Department: " + (data.department || "N/A") + "\n\n" +
               "Issue: " + (data.title || "Untitled Issue") + "\n" +
               "Type: " + (data.issue_type || "Other") + " (" + subType + ")\n" +
               "Priority: " + (data.priority || "Medium") + "\n" +
               "Blocked: " + isBlockedText + "\n" +
               "Frequency: " + (data.frequency || "One-Time") + "\n" +
               "Start Date: " + (data.issue_start_date || "N/A") + "\n" +
               "Attachment: " + (data.attachment || "None") + "\n\n" +
               "Description: " + (data.description || "No description provided") + "\n\n" +
               "Please log in to the CRM to assign and resolve this ticket.";

  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
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
  });
}

/**
 * 3. SYNC FROM SHEET TO SUPABASE (2-Way Sync)
 * This runs when a cell in the spreadsheet is edited.
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const col = range.getColumn();

  // We only care about the "Tickets" sheet and Column 13 (Status)
  if (sheet.getName() === "Tickets" && col === 13 && row > 1) {
    const newStatus = range.getValue();
    const id = sheet.getRange(row, 15).getValue(); // Col 15 is where Ticket ID is stored
    
    if (id) {
      updateSupabaseStatus(id, newStatus);
      
      // If status is Resolved, send email to user
      if (newStatus === "Resolved") {
        const userEmail = sheet.getRange(row, 3).getValue();
        const ticketTitle = sheet.getRange(row, 5).getValue();
        sendResolutionEmail(userEmail, ticketTitle, id);
      }
    }
  }
}

function updateSupabaseStatus(id, status) {
  const url = SUPABASE_URL + "/rest/v1/tickets?id=eq." + id;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };
  
  const payload = JSON.stringify({ status: status });
  const options = {
    method: "patch",
    headers: headers,
    payload: payload,
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

function sendResolutionEmail(email, title, id) {
  const subject = "✅ Ticket Resolved: " + title;
  const body = "Great news! Your ticket has been marked as RESOLVED.\n\n" +
               "Ticket ID: #" + id.substring(0, 8) + "\n" +
               "Title: " + title + "\n\n" +
               "If you are still facing issues, please reply to this email or raise a new ticket in the ESS portal.\n\n" +
               "Best regards,\nBuildFlow IT Support Team";
  
  if (email && email !== "N/A") {
    MailApp.sendEmail(email, subject, body);
  }
}
