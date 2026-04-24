# IT Helpdesk CRM (Elite Governance Edition)

A high-performance, production-ready IT Asset & Service Management platform designed for enterprise-grade hardware governance and incident response.

## 🚀 Overview

This IT Helpdesk CRM bridges the gap between rapid inventory management and proactive incident resolution. It features a robust **2-way synchronization** between a Supabase-backed React application and Google Sheets, ensuring that data is accessible both for real-time operations and long-term reporting.

---

## ✨ Core Features

### 🎫 Advanced Ticketing System
- **Intelligent SLA Management**: Automated resolution deadlines based on ticket priority and department-specific overrides (e.g., Engineering Critical tickets resolve in 2h).
- **Status State Machine**: Strict transition logic (Open → Assigned → In Progress → Resolved → Closed) to maintain operational integrity.
- **Guest Support**: Ability to raise tickets for unregistered users while preserving their name, email, and department details.
- **Real-time Notifications**: Webhook-integrated email alerts for new tickets and SLA breaches.

### 💻 Asset & Inventory Hub
- **Professional Bulk Import**: Rapid hardware onboarding via Excel (.xlsx) and multi-line text input.
- **Lifecycle Auditing**: A complete transaction ledger tracking every allocation, deallocation, and registration event.
- **Inventory Reporting**: One-click Excel export of the entire organization's hardware estate.
- **Missing Asset Protocol**: Automated investigation ticket creation when an asset is flagged during an audit.

### 📊 Analytics & Reporting
- **Insights Dashboard**: Real-time visualization of ticket trends, SLA breach rates, and team performance.
- **Excel Report Generator**: Multi-sheet workbook exports containing raw data and high-level KPI summaries.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Vanilla CSS with Bento-grid aesthetic, Framer Motion for premium micro-animations.
- **Database & Auth**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Spreadsheet Logic**: `xlsx` (SheetJS)
- **Automation**: Google Apps Script (GAS) for 2-way sync and email delivery.

---

## ⚙️ Setup & Installation

### 1. Frontend Setup
```bash
# Clone the repository
git clone https://github.com/msaxena1212/it_helpdesk.git

# Install dependencies
npm install

# Configure Environment Variables
# Create a .env file with the following:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_WEBHOOK_URL=your_google_apps_script_url

# Run locally
npm run dev
```

### 2. Database Configuration
Execute the provided `supabase_schema.sql` in your Supabase SQL Editor to initialize:
- `tickets` table (with SLA tracking)
- `assets` table (inventory)
- `asset_history` (audit logs)
- `profiles` (user management)

### 3. Google Apps Script Integration
1. Create a new Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Copy the contents of `google_apps_script.js` into the editor.
4. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Deploy as a **Web App** and paste the URL into your `.env` file.

---

## 📋 Data Schema Requirements

### Asset Bulk Import Format
The system expects a 4-column Excel structure for imports:
1. `Model Name`
2. `Serial Number/ID`
3. `Purchase Date`
4. `Status` (In Stock, Allocated, etc.)

### Ticket Data Fields
- `Title`, `Description`, `Issue Type`, `Sub-Type`
- `Priority` (Critical, High, Medium, Low)
- `Department` (Engineering, HR, Sales, etc.)
- `Is Blocked` (Boolean)
- `Frequency` (One-Time, Intermittent, Always)

---

## 🚀 Advancement: SLA & Escalation Engine (USP #2)

### ❌ Current Problem
In most helpdesks, SLA tracking is passive. Breaches go unnoticed, managers are only informed manually, and delays often compound without intervention.

### ✅ Elite Upgrade
Our **SLA & Escalation Engine** provides proactive governance:
- **Multi-Stage Escalation**:
    - **Stage 1 (Breach)**: Immediate notification to assigned admin.
    - **Stage 2 (L1 - 2hrs post-breach)**: Automated priority upgrade to **Critical**.
    - **Stage 3 (L2 - 4hrs post-breach)**: Automated **Senior Management Alert** via high-priority webhook.
- **Visual Accountability**: Real-time escalation badges (L1/L2) on dashboards for instant visibility of high-risk tickets.

---

## 🚀 Advancement: Analytics & Decision Dashboard (USP #3)

### ❌ Current Problem
Data is often trapped in spreadsheets or hidden in row-level views. Managers lack real-time visibility into agent productivity, resolution bottlenecks, and historical trends.

### ✅ Elite Upgrade
The **Decision Dashboard** transforms raw data into actionable operational intelligence:
- **Real-Time KPI Tracking**: Instant visibility into **Avg Resolution Time**, **SLA Breach Rates**, and **Ticket Volume Trends**.
- **Agent Performance Matrix**: High-density analytics showing tickets per agent, resolution rates, and individual SLA compliance.
- **Trend Visualization**: Daily and weekly time-series charts to identify peak volume periods and resource needs.
- **Deep Category Analysis**: Horizontal distribution charts to pinpoint recurring software or hardware bottlenecks.

---

## 🚀 Advancement: Role-Based Intelligence & Audit Logs (USP #7)

### ❌ Current Problem
In basic helpdesks, accountability is often missing. Actions like status changes or assignments are rarely tracked in a central ledger, making it difficult to reconstruct the timeline of an incident or audit system-wide performance.

### ✅ Elite Upgrade
Our **Governance Framework** ensures total accountability across the organization:
- **System-Wide Audit Log**: A centralized, high-density ledger for SuperAdmins that captures every operational event, including performer IDs, timestamps, and linked entities.
- **Action Fidelity**: Automatic logging of all major events: ticket creation, priority shifts, status transitions, and automated SLA escalations.
- **Role-Based Command Centers**: 
    - **Employees**: Focus on personal productivity and asset health.
    - **IT Admins**: Focus on team workload and ticket resolution.
    - **SuperAdmins**: Focus on system governance, user permissions, and audit transparency.

---

## 🔐 Security & Governance
- **Granular Permissions**: Built-in logic for Employee, Admin, and SuperAdmin roles.
- **Activity Logging**: Every status change and ticket comment is timestamped and attributed to a performer.
- **SLA Breach Monitoring**: Background processes automatically flag delayed tickets and notify management.

---

## 📄 License
Internal Corporate Use Only. Created by Elite Mindz.