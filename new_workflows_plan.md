# Feature Expansion: Operations & HR Workflows

This document outlines the proposed architecture and workflows for expanding the IT Helpdesk CRM to handle Deployment Requests, Source Control Access, Subscription Management, and full-lifecycle Employee Self-Service (ESS).

## 1. Deployment Request Flow (Code to Production)
**Goal:** Formalize the process of deploying code to live servers, ensuring proper approvals and an audit trail.

### Workflow:
1. **Submission:** A Developer or Team Lead raises a ticket with the type `Deployment Request`.
   - **Required Fields:** Project Name, Target Environment (Staging/Production), Branch/Tag Name, Release Notes, and Rollback Plan.
2. **Approval Gate:** The ticket is automatically routed to the Engineering Manager or QA Lead for approval.
3. **Execution:** Approved tickets are assigned directly to the dedicated DevOps employee. The DevOps employee is then responsible for making the code live on the server.
4. **Resolution:** Once live, the ticket is marked as `Resolved (Deployed)`.

---

## 2. GitLab Access Request Flow
**Goal:** Securely manage and audit source code access requests.

### Workflow:
1. **Submission:** An employee raises an `Access Request` ticket.
   - **Required Fields:** GitLab Repository URL, Requested Role (Guest, Reporter, Developer, Maintainer), and Justification.
2. **Approval Gate:** Routed to the Project Manager or Repo Owner for security approval.
3. **Fulfillment:** 
   - *Manual Phase:* IT/DevOps manually grants access in GitLab and resolves the ticket.
   - *Automated Phase (Future):* Integration with GitLab API automatically adds the user to the project upon approval.
4. **Audit Logging:** The action is permanently recorded in the `asset_history` or a dedicated IAM log for compliance.

---

## 3. Subscription Reminders & Payment Notifications
**Goal:** Prevent service interruptions by proactively tracking recurring software subscriptions and payments (e.g., AWS, SaaS tools, Domain renewals).

### Architecture & Workflow:
1. **Data Model:** Create a `subscriptions` database table to track:
   - `Service Name`, `Cost`, `Billing Cycle (Monthly/Yearly)`, `Next Due Date`, `Owner/Department`.
2. **Cron Automation:** Implement a daily Supabase Edge Function (or `pg_cron`) to scan for upcoming payments.
3. **Alerts (7 & 3 Days Prior):**
   - **Email:** Automatically trigger emails (via Resend/SMTP) to the Finance team and the internal Owner.
   - **Calendar Integration:** Generate and attach a `.ics` calendar event payload to the email so the owner can add it to Google Calendar/Outlook.
4. **Dashboard View:** Create a "Subscriptions" module for SuperAdmins to visualize upcoming expenses on a timeline.

---

## 4. Complete Employee Self-Service (ESS): Hire to Exit
**Goal:** Provide a centralized hub for all HR and IT-related employee lifecycle events, automating approvals and maintaining accurate records.

### A. Onboarding (Hire)
* **Trigger:** HR submits a "New Hire Request" via the administrative dashboard.
* **Auto-Generated Workflows:**
  1. **Hardware Provisioning:** Auto-creates an "Inventory Request" ticket assigned to the Inventory Manager for Laptop/ID Card allocation.
  2. **Account Creation:** Auto-creates a ticket for SuperAdmins to generate Google Workspace and internal CRM credentials.
  3. **Access Provisioning:** Auto-creates specific tool access tickets (GitLab, Slack, AWS).

### B. Active Employment (The ESS Portal)
Employees have access to a dedicated unified ESS dashboard to manage their daily needs:

1. **Leave & Attendance Management:**
   - **Leave Application:** Employees can request Sick, Casual, Privilege, or Unpaid leave, specifying dates and reasons.
   - **Approval Routing:** Requests are automatically sent to the Direct Manager for Approval/Rejection.
   - **Tracking:** Real-time visibility into leave balance and holiday calendars.

2. **Payroll & Document Requests:**
   - **Salary Slips:** Employees can request specific monthly payslips or Form-16s. The request routes to the Finance/HR queue for secure fulfillment.
   - **Reimbursements:** Option to submit expense claims (Travel, Internet) by uploading receipts, which route to Finance for settlement.

3. **Grievance Redressal & HR Support:**
   - **Raise a Grievance:** A confidential ticketing system for reporting workplace issues, harassment, or policy violations. These bypass standard managers and route directly to the designated Grievance Officer / HR Head.
   - **Request HR/Management Discussion:** A structured way to request 1-on-1s, performance reviews, or career path discussions. This hooks into a calendar system to schedule a meeting with leadership.

4. **IT & Asset Service Desk:**
   - **Hardware/Software Support:** Raise break/fix tickets or request new software licenses.
   - **Asset Visibility:** View all company assets assigned to them (and sign digital acknowledgments).

### C. Offboarding (Exit)
* **Trigger:** HR or Employee submits a "Resignation/Termination" form triggering the Full & Final (F&F) process.
* **Auto-Generated Workflows:**
  1. **Asset Recovery:** Auto-creates a "Handover Pending" ticket for the Inventory Manager to collect all assigned hardware.
  2. **Access Revocation:** Auto-creates a critical priority ticket for SuperAdmin/DevOps to instantly suspend Email, GitLab, and VPN access on the Last Working Day (LWD).
  3. **Exit Interview:** Auto-schedules an HR discussion and clearance checklist (Finance, IT, Admin) for smooth offboarding.

> [!IMPORTANT]
> **User Review Required:**
> Please review these flows. Let me know which of these 4 flows you would like to prioritize for implementation first, or if you'd like to adjust any of the approval chains!
