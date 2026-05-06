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
const HR_EMAIL = "mayanksaxena@elitemindz.co";
const DEVOPS_EMAIL = "devops@yopmail.com";
const INVENTORY_EMAIL = "inventory@yopmail.com";
const NETWORK_EMAIL = "network@yopmail.com";

function logToSheet(event, type, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("System Logs");
    if (!sheet) {
      sheet = ss.insertSheet("System Logs");
      sheet.appendRow(["Timestamp", "Event", "Type", "Details"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f3f3");
    }
    sheet.appendRow([new Date(), event, type, JSON.stringify(details)]);
    if (sheet.getLastRow() > 1000) sheet.deleteRow(2); // Keep last 1000 logs
  } catch (e) {
    console.error("Logging failed: " + e.toString());
  }
}

/**
 * 1. MULTI-TYPE WEBHOOK (Receives data from the React app)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    logToSheet("Webhook Received", payload.type || "unknown", payload);
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

      const sheet = ss.getSheetByName("Tickets") || ss.getSheets()[0];
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

    // ROUTE 8: INVENTORY REQUEST NOTIFICATION
    if (payload.type === 'inventory_request' || payload.template === 'inventory_request') {
      sendInventoryRequestEmail(payload);
      return successResponse("Inventory request notification sent");
    }

    // ROUTE 10: INVENTORY HANDOVER NOTIFICATION
    if (payload.type === 'inventory_handover' || payload.template === 'inventory_handover') {
      sendInventoryHandoverEmail(payload);
      return successResponse("Inventory handover notification sent");
    }

    // ROUTE 7: NEW SUBSCRIPTION (Consolidated)
    if (payload.type === 'subscription_added') {
      // 1. Create Calendar Event
      if (payload.next_due_date) {
        createCalendarEvent({
          title: "RENEWAL DUE: " + payload.service_name,
          date: payload.next_due_date,
          description: "Reminder to renew " + payload.service_name + " (₹" + payload.cost + "). Cycle: " + payload.billing_cycle
        });
      }

      // 2. Send Email
      sendSubscriptionAddedEmail(payload);
      return successResponse("Subscription addition processed (Email + Calendar)");
    }

    // ROUTE 8: MANUAL TRIGGER FOR SUBSCRIPTION REMINDERS
    if (payload.type === 'trigger_subscription_reminders') {
      processSubscriptionReminders();
      return successResponse("Subscription reminders processed");
    }

    // ROUTE 9: DEVOPS CONFIRMATION EMAIL
    if (payload.type === 'devops_confirmation') {
      sendDevOpsConfirmationEmail(payload);
      return successResponse("DevOps confirmation email sent");
    }

    // ROUTE 10: GENERIC EMAIL NOTIFICATION (From Centralized Engine)
    if (payload.type === 'email_notification') {
      return handleEmailNotification(payload);
    }

    logToSheet("Warning", "Unmatched Route", { type: payload.type });
    return successResponse("Payload received but no matching route found: " + payload.type);

  } catch (error) {
    logToSheet("Error", "Catch Block", { error: error.toString() });
    return errorResponse(error.toString());
  }
}

/**
 * Creates an event in the user's primary Google Calendar
 */
function createCalendarEvent(data) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    console.log("Creating event for date: " + data.date);

    // Parse date safely
    let startTime = new Date(data.date);
    if (isNaN(startTime.getTime())) {
      console.error("Invalid date: " + data.date);
      return errorResponse("Invalid date provided");
    }

    let event;
    const isRenewal = (data.title || "").toLowerCase().includes("renew") || (data.title || "").toLowerCase().includes("due");

    if (isRenewal) {
      // Use All-Day event for renewals/due dates
      event = calendar.createAllDayEvent(
        data.title,
        startTime,
        {
          description: data.description || "System generated reminder from Zyno CRM.",
          guests: ADMIN_EMAIL
        }
      );
    } else {
      // Default to 1-hour event
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
      event = calendar.createEvent(
        data.title,
        startTime,
        endTime,
        {
          description: data.description || "System generated reminder from Zyno CRM.",
          guests: ADMIN_EMAIL
        }
      );
    }

    console.log("Calendar event created: " + event.getId());
    return successResponse("Calendar reminder created successfully: " + event.getId());
  } catch (e) {
    console.error("Calendar Error: " + e.toString());
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
 * Centralized Email Notification Handler
 */
function handleEmailNotification(data) {
  let recipient = data.recipient_email;

  // If no specific recipient is provided, route based on target_role or type
  if (!recipient) {
    const role = data.target_role || '';
    if (role === 'devops') recipient = DEVOPS_EMAIL;
    else if (role === 'inventory_manager') recipient = INVENTORY_EMAIL;
    else if (role === 'network_engineer') recipient = NETWORK_EMAIL;
    else if (role === 'hr') recipient = HR_EMAIL;
    else recipient = ADMIN_EMAIL;
  }

  const htmlBody = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #1e3a5f); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 20px; letter-spacing: 1px;">ZYNO NOTIFICATION</h1>
      </div>
      <div style="padding: 30px; color: #1e293b;">
        <h2 style="margin-top: 0; color: #0ea5e9; font-size: 18px;">${data.subject}</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">${data.message}</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${data.app_url || '#'}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">View Details in Portal</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; background-color: #f1f5f9; color: #94a3b8; font-size: 11px;">
        This is an automated notification from Zyno IT Helpdesk.
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: data.subject,
    htmlBody: htmlBody
  });
  return successResponse("Email notification sent");
}

/**
 * Detailed Email Notification Helper (HTML Template)
 */
function sendDetailedEmail(source, data) {
  const isBlockedText = (typeof data.is_blocked === 'boolean')
    ? (data.is_blocked ? "Yes" : "No")
    : (data.is_blocked && data.is_blocked.toString().toLowerCase().includes('yes') ? "Yes" : "No");

  const subType = data.sub_type || "General";
  let subjectPrefix = "[New Ticket]";
  let accentColor = "#0ea5e9";

  const issueType = (data.issue_type || "").trim();
  const isDevOps = ['Deployment Request', 'GitLab Access'].includes(issueType);
  const isPayslip = subType === 'Payslip';

  if (subType === 'Grievance') {
    subjectPrefix = "🚨 [CONFIDENTIAL GRIEVANCE]";
    accentColor = "#ff4444";
  } else if (isPayslip) {
    subjectPrefix = "💰 [PAYROLL REQUEST]";
    accentColor = "#4ade80";
  } else if (issueType === 'Deployment Request') {
    subjectPrefix = "🚀 [DEPLOYMENT]";
    accentColor = "#8b5cf6";
  } else if (issueType === 'GitLab Access') {
    subjectPrefix = "🦊 [GITLAB ACCESS]";
    accentColor = "#f97316";
  }

  const subject = `${subjectPrefix} ${(data.priority || "Medium")} Priority: ${data.title}`;
  let requesterName = data.name || "N/A";
  let requesterEmail = data.email || "N/A";

  if (subType === 'Grievance' && data.custom_fields && data.custom_fields.anonymous) {
    requesterName = "ANONYMOUS";
    requesterEmail = "HIDDEN";
  }

  // Route to the correct department lead
  let targetLead = ADMIN_EMAIL;
  if (isDevOps) targetLead = DEVOPS_EMAIL;
  else if (isPayslip) targetLead = HR_EMAIL;
  else if (issueType === 'Hardware' || issueType === 'Asset Request') targetLead = INVENTORY_EMAIL;
  else if (issueType === 'Network') targetLead = NETWORK_EMAIL;

  const recipients = [targetLead];
  if (requesterEmail !== "HIDDEN" && requesterEmail !== "N/A") recipients.push(requesterEmail);

  const showGenericITFields = !isDevOps && !isPayslip && subType !== 'Grievance';

  let techDetailsHtml = "";
  if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
    const cf = data.custom_fields;
    if (issueType === 'Deployment Request') {
      techDetailsHtml = `
        <div style="background-color: #f5f3ff; padding: 20px; border-radius: 12px; border: 1px solid #ddd6fe; margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px; font-size: 13px; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ddd6fe; padding-bottom: 8px;">🚀 Deployment Parameters</h4>
          <p style="margin: 6px 0; font-size: 14px;"><b>Target Env:</b> <span style="color: #7c3aed; font-weight: 700;">${cf.target_environment || "N/A"}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><b>Branch/Tag:</b> <code>${cf.branch_tag_name || "N/A"}</code></p>
          <p style="margin: 12px 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase;"><b>Release Notes:</b></p>
          <div style="font-size: 13px; color: #1e293b; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">${cf.release_notes || "N/A"}</div>
        </div>
      `;
    } else if (issueType === 'GitLab Access') {
      techDetailsHtml = `
        <div style="background-color: #fff7ed; padding: 20px; border-radius: 12px; border: 1px solid #ffedd5; margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px; font-size: 13px; color: #ea580c; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ffedd5; padding-bottom: 8px;">🦊 GitLab Access Details</h4>
          <p style="margin: 6px 0; font-size: 14px;"><b>Repo URL:</b> <a href="${cf.gitlab_repo_url}" style="color: #ea580c;">${cf.gitlab_repo_url || "N/A"}</a></p>
          <p style="margin: 12px 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase;"><b>Justification:</b></p>
          <div style="font-size: 13px; color: #1e293b; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">${cf.justification || "N/A"}</div>
        </div>
      `;
    }
  }

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, ${accentColor}, #1e3a5f); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">ZYNO IT HELPDESK</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Elite Mindz CRM System</p>
      </div>
      <div style="padding: 30px; color: #1e293b;">
        <h2 style="margin-top: 0; color: ${accentColor}; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Ticket Details: #${(data.id || "").toString().substring(0, 8).toUpperCase()}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 140px;">Requester</td>
            <td style="padding: 10px 0; color: #1e293b; font-size: 15px; font-weight: 700;">${requesterName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;">Category</td>
            <td style="padding: 10px 0; color: #1e293b; font-size: 15px;">${issueType} (${subType})</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;">Priority</td>
            <td style="padding: 10px 0;"><span style="background: ${data.priority === 'Critical' ? '#fee2e2' : '#f1f5f9'}; color: ${data.priority === 'Critical' ? '#dc2626' : '#1e293b'}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${data.priority}</span></td>
          </tr>
          ${showGenericITFields ? `
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;">Blocked</td>
            <td style="padding: 10px 0; color: #1e293b; font-size: 15px;">${isBlockedText}</td>
          </tr>
          ` : ''}
        </table>
        ${techDetailsHtml}
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
          <h3 style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Issue Description</h3>
          <p style="margin: 0; line-height: 1.6; color: #334155; font-size: 14px;">${data.description || "No description provided."}</p>
        </div>
        <div style="text-align: center; margin-top: 35px;">
          <a href="https://your-helpdesk-url.com/tickets/${data.id}" style="display: inline-block; background: ${accentColor}; color: white; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">Assign & Resolve in Portal</a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #94a3b8; font-size: 11px;">
        This is an automated notification from Zyno IT Helpdesk.<br/>
        Raised via ${source}
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipients.join(","),
    subject: subject,
    htmlBody: htmlBody
  });
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
 * 2. SYNC FROM SHEET TO SUPABASE (2-Way Sync)
 * This runs when a cell in the spreadsheet is edited.
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const col = range.getColumn();

  if (sheet.getName() === "Tickets" && col === 13 && row > 1) {
    const newStatus = range.getValue();
    const id = sheet.getRange(row, 15).getValue();

    if (id) {
      updateSupabaseStatus(id, newStatus);
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
  UrlFetchApp.fetch(url, {
    method: "patch",
    headers: headers,
    payload: JSON.stringify({ status: status }),
    muteHttpExceptions: true
  });
}

function sendResolutionEmail(email, title, id) {
  const subject = "✅ Ticket Resolved: #" + (id?.substring(0, 8) || "N/A");
  const body = "Your IT support ticket has been marked as Resolved.\n\n" +
    "Title: " + title + "\n" +
    "Ticket ID: #" + id + "\n\n" +
    "If the issue persists, please feel free to reopen it from the dashboard.\n" +
    "Thank you!";
  MailApp.sendEmail(email, subject, body);
}

function sendInventoryRequestEmail(data) {
  const subject = "📦 INVENTORY REQUEST: Ticket #" + (data.ticket_id?.substring(0, 8) || "N/A");
  const body = "A new inventory request has been raised requiring your attention.\n\n" +
    "Ticket ID: #" + data.ticket_id + "\n" +
    "Requested By: " + data.requester_name + "\n" +
    "Part Details/Remarks: " + (data.remarks || "None provided") + "\n\n" +
    "Please check the Inventory Dashboard to process this request.";

  // Send to the resolved recipient or the general inventory email
  const recipient = data.recipient_email || INVENTORY_EMAIL;
  MailApp.sendEmail({
    to: recipient,
    cc: ADMIN_EMAIL, // Admin should be looped for all emails
    subject: subject,
    body: body
  });
}

function sendInventoryHandoverEmail(data) {
  const subject = "🚚 INVENTORY READY FOR HANDOVER: Ticket #" + (data.ticket_id?.substring(0, 8) || "N/A");
  const body = "The requested inventory item is now ready for handover.\n\n" +
    "Ticket ID: #" + data.ticket_id + "\n" +
    "Please collect the item from the Inventory Manager to proceed with the ticket resolution.\n\n" +
    "Thank you.";

  // Send to the network engineer and cc admin
  const recipient = data.recipient_email || NETWORK_EMAIL;
  MailApp.sendEmail({
    to: recipient,
    cc: ADMIN_EMAIL,
    subject: subject,
    body: body
  });
}

function sendSubscriptionAddedEmail(data) {
  const subject = "📝 NEW SUBSCRIPTION ADDED: " + data.service_name;
  const body = "A new subscription has been registered in the system.\n\n" +
    "Service: " + data.service_name + "\n" +
    "Cost: ₹" + data.cost + "\n" +
    "Billing Cycle: " + data.billing_cycle + "\n" +
    "Next Due Date: " + data.next_due_date + "\n" +
    "Comment/Details: " + (data.comment || "None") + "\n\n" +
    "Please ensure the calendar is updated and payment methods are prepared.";

  const recipients = [ADMIN_EMAIL];
  if (data.owner_email && data.owner_email !== "N/A") {
    recipients.push(data.owner_email);
  }

  // Resolve notify_user_ids to emails
  if (data.notify_user_ids && Array.isArray(data.notify_user_ids) && data.notify_user_ids.length > 0) {
    try {
      const headers = { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY };
      const profilesUrl = SUPABASE_URL + "/rest/v1/profiles?select=id,email";
      const profilesRes = UrlFetchApp.fetch(profilesUrl, { method: "get", headers: headers, muteHttpExceptions: true });
      if (profilesRes.getResponseCode() === 200) {
        const profiles = JSON.parse(profilesRes.getContentText());
        const emailMap = {};
        profiles.forEach(p => emailMap[p.id] = p.email);
        
        data.notify_user_ids.forEach(id => {
          if (emailMap[id] && !recipients.includes(emailMap[id])) {
            recipients.push(emailMap[id]);
          }
        });
      }
    } catch (e) {
      logToSheet("Error", "Failed to resolve notify_user_ids", { error: e.toString() });
    }
  }

  const toEmails = [...new Set(recipients)].join(",");
  try {
    MailApp.sendEmail({
      to: toEmails,
      subject: subject,
      body: body
    });
    logToSheet("Success", "Subscription Email Sent", { to: toEmails });
  } catch (e) {
    logToSheet("Error", "Subscription Email Failed", { to: toEmails, error: e.toString() });
  }
}

/**
 * Daily Subscription Reminder Processor
 */
function processSubscriptionReminders() {
  const now = new Date();
  // Fetch Active subscriptions
  const url = SUPABASE_URL + "/rest/v1/subscriptions?status=ilike.Active";
  const headers = { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY };
  const response = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });

  if (response.getResponseCode() === 200) {
    const subscriptions = JSON.parse(response.getContentText());

    // Fetch all profiles to resolve emails
    const profilesUrl = SUPABASE_URL + "/rest/v1/profiles?select=id,email";
    const profilesRes = UrlFetchApp.fetch(profilesUrl, { method: "get", headers: headers, muteHttpExceptions: true });
    const profiles = JSON.parse(profilesRes.getContentText());
    const emailMap = {};
    profiles.forEach(p => emailMap[p.id] = p.email);

    subscriptions.forEach(sub => {
      if (sub.comment && sub.comment.trim().length > 5) return;
      const dueDate = new Date(sub.next_due_date);
      if (isNaN(dueDate.getTime())) return;

      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 7 && diffDays >= 0) {
        createCalendarEvent({
          title: "RENEWAL DUE: " + sub.service_name,
          date: sub.next_due_date,
          description: "Reminder to renew " + sub.service_name + " (₹" + sub.cost + "). Cycle: " + sub.billing_cycle
        });
      }

      if (diffDays <= 3) {
        // Resolve Recipients: notify_user_ids > owner_id > admin
        const recipients = [];
        if (sub.notify_user_ids && Array.isArray(sub.notify_user_ids)) {
          sub.notify_user_ids.forEach(id => {
            if (emailMap[id]) recipients.push(emailMap[id]);
          });
        }

        if (recipients.length === 0 && sub.owner_id && emailMap[sub.owner_id]) {
          recipients.push(emailMap[sub.owner_id]);
        }

        if (recipients.length === 0) {
          recipients.push(ADMIN_EMAIL);
        }

        // Send to all resolved recipients (unique list)
        const uniqueRecipients = [...new Set(recipients)];
        sendSubscriptionReminderEmail(sub, uniqueRecipients.join(","), diffDays);
      }
    });
  }
}

function sendSubscriptionReminderEmail(sub, email, daysLeft) {
  const safeDays = isNaN(daysLeft) ? 0 : daysLeft;
  const isOverdue = safeDays < 0;
  const subject = (isOverdue ? "🚨 OVERDUE" : "⏳ UPCOMING") + " SUBSCRIPTION PAYMENT: " + sub.service_name;
  const body = "Automated reminder for your subscription payment.\n\n" +
    "Service: " + sub.service_name + "\n" +
    "Amount: ₹" + sub.cost + "\n" +
    "Due Date: " + sub.next_due_date + "\n" +
    (isOverdue ? "STATUS: OVERDUE BY " + Math.abs(safeDays) + " DAYS\n" : "STATUS: DUE IN " + safeDays + " DAYS\n") +
    "\n" +
    "Please process the payment and update the next due date in the CRM.";
  MailApp.sendEmail(email, subject, body);
}

/**
 * DevOps Status Update
 */
function sendDevOpsConfirmationEmail(data) {
  const status = data.devops_status;
  let subjectEmoji = "✅";
  let accentColor = "#0ea5e9";
  let statusMessage = "has been processed";

  if (status === 'Access Given') { subjectEmoji = "🦊"; accentColor = "#f97316"; statusMessage = "APPROVED (Access Granted)"; }
  else if (status === 'Deployed') { subjectEmoji = "🚀"; accentColor = "#8b5cf6"; statusMessage = "SUCCESSFULLY DEPLOYED"; }
  else if (status === 'Error') { subjectEmoji = "❌"; accentColor = "#ff4444"; statusMessage = "ERROR during deployment"; }
  else if (status === 'Rejected') { subjectEmoji = "🚫"; accentColor = "#64748b"; statusMessage = "REJECTED"; }

  const recipient = data.requester_email;
  if (!recipient || recipient === "N/A" || recipient === "HIDDEN") return;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: ${accentColor}; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 22px;">DevOps Update</h1>
      </div>
      <div style="padding: 30px; color: #1e293b;">
        <p>Your request <b>"${data.title}"</b> ${statusMessage}.</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid ${accentColor}; margin: 25px 0;">
          <p style="margin: 0; font-size: 14px;"><b>Remarks:</b> ${data.remarks}</p>
          ${data.error_logs ? `<pre style="margin-top: 10px; font-size: 12px; background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 6px;">${data.error_logs}</pre>` : ''}
        </div>
        <a href="${data.app_url}" style="display: inline-block; background: ${accentColor}; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 700;">View in Portal</a>
      </div>
    </div>
  `;
  MailApp.sendEmail({ to: recipient, subject: `${subjectEmoji} DevOps Update: ${data.title}`, htmlBody: htmlBody });
}
