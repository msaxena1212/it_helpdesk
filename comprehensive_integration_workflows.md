# Comprehensive Integration Workflows

This document provides a detailed, step-by-step breakdown of the operational workflows, user journeys, functional requirements, and edge case handling for the newly proposed integrations within the IT Helpdesk CRM system.

---

## 1. Deployment Request Flow (Code to Production)

**Objective:** Standardize and secure the process of deploying code to staging and production environments, ensuring approvals, accountability, and an audit trail.

### 1.1 Functional Details
- **Data Schema Enhancements:**
  - `ticket_type`: `Deployment Request`
  - `project_name` (String, Required)
  - `target_environment` (Enum: `Staging`, `Production`, Required)
  - `branch_tag_name` (String, Required)
  - `release_notes` (Text, Required)
  - `rollback_plan` (Text, Required)
  - `approved_by` (User UUID, Reference, Nullable)
  - `deployed_by` (User UUID, Reference, Nullable)
- **Permissions:** Developers can create. Managers/QA Leads can approve/reject. DevOps can transition to 'In Progress' and 'Resolved (Deployed)'.

### 1.2 User Flow
1. **Trigger:** Developer initiates a "Deployment Request" ticket.
2. **Approval Gate:** Ticket enters `Pending Approval` state and is assigned to the QA Lead/Engineering Manager.
3. **Execution Gate:** Upon approval, status changes to `Approved` and ticket reassigns to the DevOps queue.
4. **Action:** DevOps updates status to `In Progress` while deploying.
5. **Completion:** DevOps marks as `Resolved (Deployed)`.

### 1.3 User Journey
**Scenario: Pushing a hotfix to Production**
- **Alex (Developer)** finishes coding a critical hotfix. They open the ESS portal, select "New Deployment Request", fill in the target environment as "Production", branch as "hotfix-auth-bug", and document the rollback plan. They hit "Submit".
- **Sam (QA Lead)** receives an immediate email/Slack notification. They review the PR linked in the release notes. Everything looks solid. Sam clicks "Approve".
- **Jordan (DevOps)** sees a new ticket appear in the "Approved Deployments" queue. Jordan clicks "Start Deployment", changing the status. Once the CI/CD pipeline completes, Jordan clicks "Mark as Deployed", which auto-emails Alex and Sam that the hotfix is live.

### 1.4 Error Handling & Edge Cases
- **Edge Case - Approver Unavailable:** If the designated approver is on leave, the system must allow a fallback approver (e.g., Secondary Manager or SuperAdmin) to override and approve.
- **Error Case - Deployment Failure:** If the deployment fails or causes an outage, DevOps can mark the ticket as `Failed / Rolled Back`. The system must enforce a mandatory "Reason for Failure" text input before allowing this status change.
- **Edge Case - Missing Rollback Plan:** The frontend form validation must rigorously block submission if the rollback plan is empty or less than 50 characters to prevent inadequate planning.

---

## 2. GitLab Access Request Flow

**Objective:** Securely manage, fulfill, and audit source control access requests to comply with internal security policies.

### 2.1 Functional Details
- **Data Schema Enhancements:**
  - `ticket_type`: `Access Request - GitLab`
  - `gitlab_repo_url` (String, Required)
  - `requested_role` (Enum: `Guest`, `Reporter`, `Developer`, `Maintainer`, Required)
  - `justification` (Text, Required)
- **Integrations:** Future phase requires a direct webhook/API integration with GitLab to auto-provision based on the `requested_role`.

### 2.2 User Flow
1. **Trigger:** Employee requests repository access via the Helpdesk portal.
2. **Security Gate:** Ticket routes to Project Manager or Repository Owner. Status becomes `Pending Security Approval`.
3. **Fulfillment Gate:** Manager approves. Ticket routes to IT/DevOps (`Approved` state).
4. **Provisioning:** IT/DevOps manually (or system automatically) provisions access in GitLab and marks the ticket `Provisioned`.

### 2.3 User Journey
**Scenario: New employee needing code access**
- **Casey (New Hire)** tries to access the `backend-api` repo but gets a 404. They go to the Helpdesk, select "GitLab Access", paste the URL, select "Developer" role, and write "Need access for my first sprint tasks."
- **Taylor (Project Manager)** gets an alert, verifies Casey is indeed on the project, and hits "Approve".
- **Jordan (DevOps)** gets the approved ticket. Jordan logs into GitLab, adds Casey to the repo, and closes the ticket as "Provisioned". Casey gets an email saying they can now access the code.

### 2.4 Error Handling & Edge Cases
- **Edge Case - Over-privileged Role Request:** If a user requests "Maintainer" access, the UI should display a warning modal stating "Maintainer access requires SuperAdmin approval." The approval chain dynamically adds a second tier (SuperAdmin) for this specific role.
- **Error Case - Invalid URL:** The frontend must regex-validate the `gitlab_repo_url` to ensure it points to the company's actual GitLab domain before submission.
- **Error Case - API Auto-Provisioning Fails (Future):** If the GitLab API is down or returns a 403, the system must catch the error, log it, and fallback by assigning the ticket to the manual IT queue with a status of `Manual Intervention Required`.

---

## 3. Subscription Reminders & Payment Notifications

**Objective:** Prevent operational downtime by automating reminders for recurring software subscriptions, cloud infrastructure, and domain renewals.

### 3.1 Functional Details
- **Data Schema Enhancements (New `subscriptions` table):**
  - `id` (UUID, Primary Key)
  - `service_name` (String, Required)
  - `cost` (Decimal, Required)
  - `billing_cycle` (Enum: `Monthly`, `Yearly`)
  - `next_due_date` (Date, Required)
  - `owner_id` (User UUID, Reference)
  - `status` (Enum: `Active`, `Cancelled`, `Expired`)
- **Backend Jobs:** A Supabase Edge Function running daily (cron job).

### 3.2 User Flow
1. **Data Entry:** Finance/SuperAdmin registers a subscription in the database.
2. **Monitoring:** System silently monitors dates.
3. **Alerting:** At exactly `next_due_date - 7 days` and `- 3 days`, system triggers an email payload.
4. **Resolution:** Finance logs in, pays the invoice, and clicks "Renew" on the subscription card, updating the `next_due_date`.

### 3.3 User Journey
**Scenario: Renewing a crucial SaaS tool**
- The company uses "DesignPro" billed yearly. 
- 7 days before the renewal date, the system cron job runs.
- **Morgan (Design Lead)** and the Finance team receive an automated email: "Action Required: DesignPro renewal of $500 due in 7 days." The email includes an attached `.ics` calendar event which Morgan adds to their Google Calendar.
- Finance processes the payment and clicks "Mark Paid & Renew" in the CRM. The system automatically shifts the `next_due_date` to exactly one year later.

### 3.4 Error Handling & Edge Cases
- **Error Case - Cron Job Failure:** If the daily cron job fails to execute, a dead-letter queue or monitoring alert (e.g., via Sentry) must immediately ping the SuperAdmins so reminders aren't missed.
- **Edge Case - Cancelled Subscriptions:** If a tool is no longer needed, the owner marks it as `Cancelled`. The cron job must explicitly filter out `Cancelled` subscriptions to prevent ghost notifications.
- **Error Case - Owner Left Company:** If the assigned `owner_id` is deactivated (employee exited), the cron job must catch the null/inactive user reference and fallback to emailing the SuperAdmin and Finance by default.

---

## 4. Complete Employee Self-Service (ESS): Hire to Exit

**Objective:** Provide a unified interface for all HR, IT, and administrative tasks throughout an employee's lifecycle.

### 4.1 Functional Details
- **Data Architecture:** A centralized `employee_profiles` table linked to the `users` table. 
- **Modules:** Leave Management, Payroll Requests, Grievance, Helpdesk, Assets.
- **Complex Triggers:** Event-driven architecture where an HR action ("Onboard" / "Offboard") spawns multiple disparate child tickets across different departments.

### 4.2 User Flow
- **Onboarding:** HR submits form -> System generates IT, Asset, and Access tickets -> All resolve -> Status: Active.
- **Active (e.g., Leave Request):** Employee submits dates -> Manager approves -> System deducts balance.
- **Offboarding:** HR triggers exit -> System generates "Collect Assets", "Revoke Access", and "F&F Clearance" tickets -> All resolve -> Status: Inactive.

### 4.3 User Journey
**Scenario: Employee Offboarding**
- **Jamie (HR)** receives a resignation letter from Alex. Jamie goes to the ESS Admin panel and triggers "Initiate Offboarding" for Alex, setting the Last Working Day (LWD) to Friday.
- Instantly, three things happen:
  1. **IT Team** gets a P1 ticket scheduled for Friday 5 PM: "Revoke all system access for Alex".
  2. **Inventory Manager** gets a ticket: "Collect MacBook Pro (Tag: MAC-042) from Alex".
  3. **Finance** gets a task: "Process Full & Final Settlement for Alex".
- On Friday, as each department finishes their task, they close their respective tickets. Once the final ticket closes, Alex's CRM profile automatically archives.

### 4.4 Error Handling & Edge Cases
- **Edge Case - Negative Leave Balance:** If an employee requests more leave than they have accrued, the UI must block submission unless they explicitly check a box acknowledging "This will result in Loss of Pay (Unpaid Leave)".
- **Error Case - Dependent Ticket Blocking Offboarding:** If the Inventory Manager cannot collect the laptop (e.g., it was lost), they must be able to mark the ticket as `Blocked - Escalate`. The system should immediately alert Finance to deduct the cost from the F&F settlement before closing the offboarding loop.
- **Edge Case - Grievance Confidentiality:** If an employee raises a Grievance against their *own* manager, the system must have strict Row Level Security (RLS) policies ensuring the manager absolutely cannot view the ticket, even if they have standard elevated department privileges. It must route exclusively to HR.
