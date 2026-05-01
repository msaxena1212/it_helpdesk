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

    // ROUTE 7: NEW SUBSCRIPTION NOTIFICATION
    if (payload.type === 'subscription_added') {
      sendSubscriptionAddedEmail(payload);
      return successResponse("Subscription addition notification sent");
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
      { 
        description: data.description || "System generated reminder from Zyno CRM.",
        guests: ADMIN_EMAIL // This ensures the event appears on your calendar too
      }
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

const HR_EMAIL = "mayanksaxena@elitemindz.co"; // Update with actual HR email

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
  
  // 1. Set Branding based on Type
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

  const recipients = [ADMIN_EMAIL];
  if (requesterEmail !== "HIDDEN" && requesterEmail !== "N/A") recipients.push(requesterEmail);
  if (isPayslip) recipients.push(HR_EMAIL);

  // 2. Filter Fields (Hide irrelevant fields for specific types)
  const showGenericITFields = !isDevOps && !isPayslip && subType !== 'Grievance';

  // 3. Prepare Technical Sections
  let techDetailsText = "";
  let techDetailsHtml = "";
  
  if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
    const cf = data.custom_fields;
    
    if (issueType === 'Deployment Request') {
      techDetailsText = `\n--- DEPLOYMENT INFO ---\n` +
                        `Environment: ${cf.target_environment || "N/A"}\n` +
                        `Branch/Tag: ${cf.branch_tag_name || "N/A"}\n` +
                        `Release Notes: ${cf.release_notes || "N/A"}\n` +
                        `Rollback Plan: ${cf.rollback_plan || "N/A"}\n`;
      
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
      techDetailsText = `\n--- GITLAB ACCESS INFO ---\n` +
                        `Repo URL: ${cf.gitlab_repo_url || "N/A"}\n` +
                        `Justification: ${cf.justification || "N/A"}\n`;
      
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

  const plainBody = `A new ticket has been raised via ${source}.\n\n` +
                    `User: ${requesterName} (${requesterEmail})\n` +
                    `Department: ${data.department || "General"}\n\n` +
                    `Issue: ${data.title}\n` +
                    `Type: ${issueType} (${subType})\n` +
                    `Priority: ${data.priority}\n` +
                    (showGenericITFields ? `Blocked: ${isBlockedText}\nFrequency: ${data.frequency || "N/A"}\n` : "") +
                    techDetailsText + "\n" +
                    `Description: ${data.description || "No description"}\n\n` +
                    `Please log in to the CRM to assign and resolve this ticket.`;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, ${accentColor}, #1e3a5f); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">ZYNO IT HELPDESK</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Elite Mindz CRM System</p>
      </div>
      
      <div style="padding: 30px; color: #1e293b;">
        <h2 style="margin-top: 0; color: ${accentColor}; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Ticket Details: #${(data.id || "").toString().substring(0,8).toUpperCase()}</h2>
        
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
          <a href="http://localhost:5173/tickets/${data.id}" style="display: inline-block; background: ${accentColor}; color: white; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">Assign & Resolve in Portal</a>
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
    body: plainBody,
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

  // SLA Deadline: calculate based on priority (must match React app logic)
  const baseSlaHours = { 'Critical': 4, 'High': 8, 'Medium': 24, 'Low': 72 };
  const slaDuration = baseSlaHours[priority] || 24;
  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + slaDuration);

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
    issue_start_date: formattedDate,
    sla_deadline: slaDeadline.toISOString()
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
  const subject = "✅ Ticket Resolved: #" + (id?.substring(0, 8) || "N/A");
  const body = "Your IT support ticket has been marked as Resolved.\n\n" +
    "Title: " + title + "\n" +
    "Ticket ID: #" + id + "\n\n" +
    "If the issue persists, please feel free to reopen it from the dashboard.\n" +
    "Thank you!";

  MailApp.sendEmail(email, subject, body);
}

/**
 * New Subscription Added Notification
 */
function sendSubscriptionAddedEmail(data) {
  const subject = "📝 NEW SUBSCRIPTION ADDED: " + data.service_name;
  const body = "A new subscription has been registered in the system.\n\n" +
    "Service: " + data.service_name + "\n" +
    "Cost: \u20b9" + data.cost + "\n" +
    "Billing Cycle: " + data.billing_cycle + "\n" +
    "Next Due Date: " + data.next_due_date + "\n" +
    "Comment/Details: " + (data.comment || "None") + "\n\n" +
    "Please ensure the calendar is updated and payment methods are prepared.";

  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
}

/**
 * Daily Subscription Reminder Processor
 * (Recommended: Set a Time-Driven Trigger to run this daily)
 */
function processSubscriptionReminders() {
  const now = new Date();
  
  // Fetch all Active subscriptions (case-insensitive)
  const url = SUPABASE_URL + "/rest/v1/subscriptions?select=*,profiles!owner_id(name,email)&status=ilike.Active";

  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY
  };

  const response = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });

  if (response.getResponseCode() === 200) {
    const subscriptions = JSON.parse(response.getContentText());
    console.log("Processing " + subscriptions.length + " active subscriptions for reminders.");

    subscriptions.forEach(sub => {
      // If user provided a comment (ignore logic), we skip reminders
      if (sub.comment && sub.comment.trim().length > 5) {
        console.log("Skipping reminder for " + sub.service_name + " due to user comment.");
        return;
      }

      const dueDate = new Date(sub.next_due_date);
      if (isNaN(dueDate.getTime())) {
        console.error("Invalid date for " + sub.service_name + ": " + sub.next_due_date);
        return;
      }

      const diffTime = dueDate.getTime() - now.getTime();
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (isNaN(diffDays)) {
        console.error("Calculation failed for " + sub.service_name);
        return;
      }

      // 1. If within 7 days, create calendar event
      if (diffDays <= 7 && diffDays >= 0) {
        createCalendarEvent({
          title: "RENEWAL DUE: " + sub.service_name,
          date: sub.next_due_date,
          description: "Reminder to renew " + sub.service_name + " (\u20b9" + sub.cost + "). Cycle: " + sub.billing_cycle
        });
      }

      // 2. If overdue OR within 3 days, send reminder email
      if (diffDays <= 3) {
        // Handle case where Supabase might return profiles as an array or object
        const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
        const ownerEmail = (profile && profile.email) ? profile.email : ADMIN_EMAIL;
        sendSubscriptionReminderEmail(sub, ownerEmail, diffDays);
      }
    });
  }
}

function sendSubscriptionReminderEmail(sub, email, daysLeft) {
  // Ensure we don't pass NaN to the email
  const safeDays = isNaN(daysLeft) ? 0 : daysLeft;
  console.log("Preparing email for: " + email + " | Days Left: " + safeDays);
  
  const isOverdue = safeDays < 0;
  const subject = (isOverdue ? "\ud83d\udea8 OVERDUE" : "\u23f3 UPCOMING") + " SUBSCRIPTION PAYMENT: " + (sub.service_name || "Unknown Service");
  
  const body = "This is an automated reminder for your subscription payment.\n\n" +
    "Service: " + (sub.service_name || "N/A") + "\n" +
    "Amount: \u20b9" + (sub.cost || 0) + "\n" +
    "Due Date: " + (sub.next_due_date || "N/A") + "\n" +
    (isOverdue ? "STATUS: OVERDUE BY " + Math.abs(safeDays) + " DAYS\n" : "STATUS: DUE IN " + safeDays + " DAYS\n") +
    "\n" +
    "Please process the payment and update the next due date in the CRM.\n" +
    "If this subscription is discontinued, please mark it as Cancelled or enter a comment to stop reminders.";

  // Send primary email
  MailApp.sendEmail(email, subject, body);
  
  // Copy admin if owner is different
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanAdmin = ADMIN_EMAIL.trim().toLowerCase();
  
  if (cleanEmail !== cleanAdmin) {
    console.log("Sending COPY to admin because " + cleanEmail + " != " + cleanAdmin);
    MailApp.sendEmail(ADMIN_EMAIL, "COPY: " + subject, body);
  } else {
    console.log("Skipping COPY because recipient is the admin.");
  }
}

/**
 * Sends a confirmation email to the user when DevOps updates a technical ticket
 */
function sendDevOpsConfirmationEmail(data) {
  const status = data.devops_status;
  let subjectEmoji = "✅";
  let accentColor = "#0ea5e9";
  let statusMessage = "has been processed";

  if (status === 'Access Given') {
    subjectEmoji = "🦊";
    accentColor = "#f97316";
    statusMessage = "has been APPROVED and access has been granted";
  } else if (status === 'Deployed') {
    subjectEmoji = "🚀";
    accentColor = "#8b5cf6";
    statusMessage = "has been successfully DEPLOYED to production";
  } else if (status === 'Error') {
    subjectEmoji = "❌";
    accentColor = "#ff4444";
    statusMessage = "encountered an ERROR during deployment and has been sent back to you for fix";
  } else if (status === 'Rejected') {
    subjectEmoji = "🚫";
    accentColor = "#64748b";
    statusMessage = "has been REJECTED";
  }

  const subject = `${subjectEmoji} DevOps Update: Your request ${statusMessage}`;
  const recipient = data.requester_email;

  if (!recipient || recipient === "N/A" || recipient === "HIDDEN") return;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: ${accentColor}; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 22px;">DevOps Status Update</h1>
        <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Ticket #${data.ticket_id.substring(0,8).toUpperCase()}</p>
      </div>
      
      <div style="padding: 30px; color: #1e293b;">
        <p style="font-size: 16px; margin-top: 0;">Hello <b>${data.requester_name}</b>,</p>
        <p style="font-size: 15px; line-height: 1.6;">Your request <b>"${data.title}"</b> ${statusMessage}.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid ${accentColor}; margin: 25px 0;">
          <h4 style="margin: 0 0 10px; font-size: 13px; color: #64748b; text-transform: uppercase;">DevOps Remarks</h4>
          <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">${data.remarks}</p>
          ${data.error_logs ? `
            <h4 style="margin: 15px 0 10px; font-size: 13px; color: #dc2626; text-transform: uppercase;">Technical Logs / Error</h4>
            <pre style="margin: 0; font-size: 12px; background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto;">${data.error_logs}</pre>
          ` : ''}
        </div>

        <p style="font-size: 14px; color: #64748b; margin-bottom: 25px;">
          ${status === 'Error' ? '<b>Please fix the reported error and click "Fix Applied - Resubmit" in the portal.</b>' : 'No further action is required from your side.'}
        </p>

        <a href="${data.app_url}" style="display: inline-block; background: ${accentColor}; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">View Ticket in Portal</a>
      </div>
      
      <div style="padding: 20px; text-align: center; background-color: #f1f5f9; color: #64748b; font-size: 12px;">
        This is an automated notification from Elite Mindz IT Helpdesk.
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });
}
