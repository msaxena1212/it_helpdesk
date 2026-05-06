import { supabase } from './supabase';

// Granular Permissions

export const PERMISSIONS = {
  CREATE_TICKET: 'CREATE_TICKET',
  VIEW_ALL: 'VIEW_ALL',
  ASSIGN_TICKET: 'ASSIGN_TICKET',
  UPDATE_STATUS: 'UPDATE_STATUS',
  CONFIG_SLA: 'CONFIG_SLA',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_ASSETS: 'MANAGE_ASSETS',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'employee': [PERMISSIONS.CREATE_TICKET],
  'admin': [PERMISSIONS.VIEW_ALL, PERMISSIONS.ASSIGN_TICKET, PERMISSIONS.UPDATE_STATUS, PERMISSIONS.MANAGE_ASSETS, PERMISSIONS.VIEW_ANALYTICS],
  'inventory_manager': [PERMISSIONS.VIEW_ALL, PERMISSIONS.UPDATE_STATUS],
  'devops': [PERMISSIONS.VIEW_ALL, PERMISSIONS.UPDATE_STATUS],
  'superadmin': Object.values(PERMISSIONS)
};

// --- Notification Engine ---

export const sendNotification = async (params: {
  userIds: string[],
  type: string,
  title: string,
  message: string,
  severity?: 'Info' | 'Warning' | 'High',
  ticketId?: string,
  emailData?: any
}) => {
  const { userIds, type, title, message, severity = 'Info', ticketId, emailData } = params;
  
  if (userIds.length === 0) return;

  // 1. Database Notifications
  const notifications = userIds.map(uid => ({
    user_id: uid,
    type,
    title,
    message,
    severity,
    ticket_id: ticketId,
    is_read: false
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  if (error) console.error("Notification Error:", error);

  // 2. Email Webhook (External)
  const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';
  if (googleWebhookUrl && emailData) {
    // Fetch emails for the userIds
    const { data: profiles } = await supabase.from('profiles').select('email').in('id', userIds);
    const emails = profiles?.map(p => p.email).filter(Boolean) || [];

    if (emails.length > 0) {
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: 'email_notification',
          subject: title,
          message,
          recipient_email: emails.join(','), // Send to all targeted users
          ...emailData,
          app_url: window.location.origin + (ticketId ? `/tickets/${ticketId}` : '')
        })
      }).catch(err => console.error("Email Webhook Error:", err));
    }
  }
};

export const notifyAdmins = async (params: Omit<Parameters<typeof sendNotification>[0], 'userIds'>) => {
  const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
  if (admins) {
    await sendNotification({ ...params, userIds: admins.map(a => a.id) });
  }
};

export const notifyRoles = async (roles: string[], params: Omit<Parameters<typeof sendNotification>[0], 'userIds'>) => {
  const { data: users } = await supabase.from('profiles').select('id').in('role', roles);
  if (users) {
    await sendNotification({ ...params, userIds: users.map(u => u.id) });
  }
};

export const createTicket = async (ticketData: any) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { title, description, issue_type, sub_type, priority, device_id, employee_id, guest_name, guest_email, is_blocked, issue_start_date, frequency } = ticketData;
  
  // Logic: Use provided employee_id OR provided guest info. 
  // ONLY fallback to logged-in user if neither is provided (i.e. self-service ticket)
  const targetEmployeeId = employee_id || (guest_name ? null : userData.user.id);

  // Ticket Flooding Check: Limit 5 tickets/user/hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', targetEmployeeId)
    .gt('created_at', oneHourAgo);

  if (recentCount && recentCount >= 5) {
    throw new Error('Ticket limit exceeded. You can only raise 5 tickets per hour.');
  }

  // Duplicate Check: Same user + same title within 10 mins
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('tickets')
    .select('id')
    .eq('employee_id', targetEmployeeId)
    .eq('title', title)
    .gt('created_at', tenMinsAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error('Similar ticket exists. Please wait a few minutes before creating a duplicate.');
  }

  // SLA logic based on priority AND department
  const baseSlaHours: Record<string, number> = {
    'Critical': 4,
    'High': 8,
    'Medium': 24,
    'Low': 72
  };

  // Department-specific overrides
  const departmentOverrides: Record<string, Record<string, number>> = {
    'Engineering': { 'Critical': 2, 'High': 4 },
    'Operations': { 'Critical': 3 },
  };

  const employeeDept = ticketData.department || 'General';
  const slaDuration = departmentOverrides[employeeDept]?.[priority as string] || baseSlaHours[priority as string] || 24;

  const sla_deadline = new Date();
  sla_deadline.setHours(sla_deadline.getHours() + slaDuration);

  // Auto-assignment for specialized tickets
  let assignedTo = ticketData.assigned_to || null;
  let initialStatus = 'Open';
  let assignedRoleName = '';

  // Routing rules:
  // 1. GitLab Access, Deployment Request → DevOps
  // 2. Leave Request, HR / Payroll, Other → HR
  // 3. Hardware, Asset Request → Inventory Manager
  // 4. Everything else (Software, Network, Access / Login, Biometric Access) → Network Engineer
  const autoAssignRoles: Record<string, string> = {
    'Deployment Request': 'devops',
    'GitLab Access': 'devops',
    'Leave Request': 'hr',
    'HR / Payroll': 'hr',
    'Other': 'hr',
    'Hardware': 'inventory_manager',
    'Asset Request': 'inventory_manager',
  };

  // Default fallback role for categories not in the map
  const defaultRole = 'network_engineer';

  if (!assignedTo) {
    const targetRole = autoAssignRoles[issue_type] || defaultRole;
    assignedRoleName = targetRole;
    const { data: roleUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', targetRole)
      .limit(1);
    
    if (roleUsers && roleUsers.length > 0) {
      assignedTo = roleUsers[0].id;
      initialStatus = 'Assigned';
    }
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert([{
      title,
      description,
      issue_type,
      sub_type,
      priority,
      status: initialStatus,
      assigned_to: assignedTo,
      employee_id: targetEmployeeId,
      guest_name: targetEmployeeId ? null : guest_name,
      guest_email: targetEmployeeId ? null : guest_email,
      department: employeeDept,
      device_id,
      is_blocked: is_blocked || false,
      issue_start_date: issue_start_date || null,
      frequency: frequency || null,
      sla_deadline: sla_deadline.toISOString(),
      custom_fields: ticketData.custom_fields || {}
    }])
    .select()
    .single();

  if (error) throw error;
  
  // Log activity
  const roleLabel = assignedRoleName ? assignedRoleName.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  await supabase.from('activity_logs').insert([{
    ticket_id: data.id,
    action: `Ticket created${assignedTo ? ` and auto-assigned to ${roleLabel}` : ''}`,
    performed_by: userData.user.id
  }]);

  if (assignedTo) {
    await supabase.from('ticket_status_history').insert([{
      ticket_id: data.id,
      old_status: 'Open',
      new_status: 'Assigned',
      changed_by: userData.user.id
    }]);
  }

  // Get Requester Name for Webhook
  let requesterName = guest_name || '';
  let requesterEmail = guest_email || '';
  
  if (!requesterName && targetEmployeeId) {
    const { data: p } = await supabase.from('profiles').select('name, email').eq('id', targetEmployeeId).single();
    if (p) {
      requesterName = p.name;
      requesterEmail = p.email;
    }
  }

  // Sync to Google Sheets
  const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';
  if (googleWebhookUrl) {
    console.log(`Syncing ticket "${data.title}" to Google Sheets...`);
    try {
      // Don't await the fetch so we don't block the UI returning the ticket
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Critical for Google Apps Script redirects
        body: JSON.stringify({
          type: 'ticket',
          id: data.id,
          name: requesterName,
          email: requesterEmail,
          department: ticketData.department || '',
          title: data.title,
          description: data.description,
          issue_type: data.issue_type,
          sub_type: data.sub_type || 'General',
          priority: data.priority,
          is_blocked: data.is_blocked,
          issue_start_date: data.issue_start_date,
          frequency: data.frequency,
          custom_fields: ticketData.custom_fields || {}
        })
      }).catch(err => console.error("Sheet Sync Error:", err));
    } catch (err) {
      console.error("Sheet Sync Error:", err);
    }
  } else {
    console.warn("VITE_GOOGLE_WEBHOOK_URL is not set in .env");
  }

  // Notify Admins
  notifyAdmins({
    type: 'NEW_TICKET',
    title: `New Ticket: ${data.title}`,
    message: `${requesterName} raised a new ${data.issue_type} ticket. Priority: ${data.priority}`,
    severity: data.priority === 'Critical' ? 'High' : 'Info',
    ticketId: data.id,
    emailData: {
      template: 'ticket_created',
      ticket_id: data.id,
      requester_name: requesterName
    }
  });

  // Specialized Role Notifications
  const roleMap: Record<string, string[]> = {
    'Deployment Request': ['devops'],
    'GitLab Access': ['devops'],
    'Leave Request': ['hr'],
    'HR / Payroll': ['hr'],
    'Other': ['hr'],
    'Hardware': ['inventory_manager'],
    'Asset Request': ['inventory_manager'],
    'Software': ['network_engineer'],
    'Network': ['network_engineer'],
    'Access / Login': ['network_engineer'],
    'Biometric Access': ['network_engineer'],
  };

  const targetRoles = roleMap[data.issue_type];
  if (targetRoles) {
    notifyRoles(targetRoles, {
      type: 'ROLE_ASSIGNED',
      title: `New ${data.issue_type} Task`,
      message: `A new ticket requiring your department's attention has been raised: ${data.title}`,
      ticketId: data.id
    });
  }

  // Notify Assignee if auto-assigned (with email)
  if (assignedTo) {
    sendNotification({
      userIds: [assignedTo],
      type: 'TICKET_ASSIGNED',
      title: 'Ticket Assigned to You',
      message: `You have been assigned to: ${data.title}. Priority: ${data.priority}`,
      ticketId: data.id,
      emailData: {
        template: 'assignment',
        ticket_title: data.title,
        ticket_id: data.id,
        priority: data.priority,
        requester_name: requesterName
      }
    });
  }

  // Notify Requester of ticket creation confirmation
  if (targetEmployeeId) {
    sendNotification({
      userIds: [targetEmployeeId],
      type: 'TICKET_CREATED',
      title: 'Your Ticket Has Been Submitted',
      message: `Your request "${data.title}" has been received and ${assignedTo ? 'assigned to the ' + roleLabel + ' team' : 'is being routed'}. Ticket ID: #${data.id.substring(0,8).toUpperCase()}`,
      ticketId: data.id,
      emailData: {
        template: 'ticket_confirmation',
        ticket_title: data.title,
        ticket_id: data.id,
        priority: data.priority
      }
    });
  }

  // Create Calendar Reminder Event for Ticket SLA
  if (data.sla_deadline) {
    createReminderEvent(
      `SLA Deadline: ${data.title}`, 
      data.sla_deadline, 
      `Reminder to resolve ticket #${data.id.substring(0,8)} by ${data.sla_deadline}`
    );
  }

  return data;
};

export const getTickets = async (filters?: any) => {
  let query = supabase.from('tickets').select(`
    *,
    employee:profiles!employee_id(name, email, department),
    assigned:profiles!assigned_to(name, email),
    device:assets!device_id(device_name, device_id)
  `);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const assignTicket = async (ticketId: string, adminId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('tickets')
    .update({ 
      assigned_to: adminId,
      status: 'Assigned',
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: `Assigned to admin`,
    performed_by: userData.user?.id
  }]);

  // Notify Assignee (with email)
  sendNotification({
    userIds: [adminId],
    type: 'TICKET_ASSIGNED',
    title: 'New Ticket Assigned',
    message: `You have been assigned to ticket #${ticketId.substring(0,8)}: ${data.title}`,
    ticketId: ticketId,
    emailData: { template: 'assignment', ticket_title: data.title, ticket_id: ticketId }
  });

  // Notify Requester of assignment
  if (data.employee_id && data.employee_id !== adminId) {
    sendNotification({
      userIds: [data.employee_id],
      type: 'TICKET_UPDATE',
      title: 'Your Ticket Has Been Assigned',
      message: `Your ticket "${data.title}" has been assigned to a team member and is being worked on.`,
      ticketId: ticketId,
      emailData: { template: 'ticket_assigned_update', ticket_title: data.title, ticket_id: ticketId }
    });
  }

  // Notify Admins of assignment action (with email)
  notifyAdmins({
    type: 'ADMIN_ACTION',
    title: 'Ticket Assigned',
    message: `Admin assigned ticket #${ticketId.substring(0,8)} to another team member.`,
    ticketId: ticketId,
    emailData: { template: 'admin_action', ticket_title: data.title, ticket_id: ticketId }
  });

  return data;
};

// Ticket Status State Machine
export const VALID_TRANSITIONS: Record<string, string[]> = {
  'Open': ['Assigned', 'In Progress', 'Waiting for User', 'Waiting for Inventory', 'Resolved', 'Closed'],
  'Assigned': ['In Progress', 'Waiting for User', 'Waiting for Inventory', 'Resolved', 'Closed'],
  'In Progress': ['Waiting for User', 'Waiting for Inventory', 'Resolved', 'Closed'],
  'Waiting for User': ['In Progress', 'Resolved', 'Closed'],
  'Waiting for Inventory': ['In Progress', 'Resolved', 'Closed'],
  'Resolved': ['In Progress', 'Closed'],
  'Closed': ['In Progress', 'Open']
};

export const updateStatus = async (ticketId: string, oldStatus: string, newStatus: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  // Validate Transition
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${oldStatus} -> ${newStatus}`);
  }

  const updateData: any = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  // Reset procurement status if moving OUT of Waiting for Inventory
  if (oldStatus === 'Waiting for Inventory' && newStatus !== 'Waiting for Inventory') {
    updateData.procurement_status = null;
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  // Log Status History
  await supabase.from('ticket_status_history').insert([{
    ticket_id: ticketId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: userData.user.id
  }]);

  // Log Activity
  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: `Status changed from ${oldStatus} to ${newStatus}`,
    performed_by: userData.user.id
  }]);

  // Notify Stakeholders (employee + assignee, with email)
  const stakeholders = [data.employee_id, data.assigned_to].filter(id => id && id !== userData.user.id) as string[];
  if (stakeholders.length > 0) {
    sendNotification({
      userIds: stakeholders,
      type: 'STATUS_CHANGE',
      title: 'Ticket Status Updated',
      message: `Ticket "${data.title}" is now ${newStatus}.`,
      ticketId: ticketId,
      emailData: { template: 'status_update', new_status: newStatus, ticket_title: data.title, ticket_id: ticketId }
    });
  }

  // Notify Admins (with email)
  notifyAdmins({
    type: 'ADMIN_ACTION',
    title: 'Status Updated',
    message: `Ticket #${ticketId.substring(0,8)} "${data.title}" status changed from ${oldStatus} to ${newStatus}.`,
    ticketId: ticketId,
    emailData: { template: 'status_update', new_status: newStatus, old_status: oldStatus, ticket_title: data.title, ticket_id: ticketId }
  });

  return data;
};

export const requestInventory = async (ticketId: string, managerId: string, remarks: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'Waiting for Inventory',
      procurement_status: 'Requested',
      inventory_manager_id: managerId,
      inventory_remarks: remarks,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: 'Inventory Requested',
    performed_by: userData.user.id
  }]);

  // Create notification for Inventory Manager
  await supabase.from('notifications').insert([{
    user_id: managerId,
    type: 'INVENTORY_REQUEST',
    title: 'New Inventory Request',
    message: `Part required for ticket #${ticketId.substring(0,8)}`,
    severity: 'Info',
    ticket_id: ticketId
  }]);

  // Send Email Notification to Inventory Manager
  sendNotification({
    userIds: [managerId],
    type: 'INVENTORY_REQUEST',
    title: 'Action Required: Inventory Request',
    message: `A part has been requested for ticket #${ticketId.substring(0,8)}. Remarks: ${remarks}`,
    ticketId: ticketId,
    emailData: {
      template: 'inventory_request',
      ticket_id: ticketId,
      remarks: remarks,
      requester_name: userData.user.email?.split('@')[0] || 'Admin'
    }
  });

  // Notify the ticket requester
  const { data: reqTicket } = await supabase.from('tickets').select('employee_id, title').eq('id', ticketId).single();
  if (reqTicket?.employee_id) {
    sendNotification({
      userIds: [reqTicket.employee_id],
      type: 'TICKET_UPDATE',
      title: 'Inventory Being Arranged',
      message: `Parts are being arranged for your ticket "${reqTicket.title}". You'll be notified when ready.`,
      ticketId: ticketId,
      emailData: { template: 'inventory_update', ticket_title: reqTicket.title, ticket_id: ticketId }
    });
  }

  // Notify Admins
  notifyAdmins({
    type: 'ADMIN_ACTION',
    title: 'Inventory Requested',
    message: `Inventory requested for ticket #${ticketId.substring(0,8)}. Remarks: ${remarks}`,
    ticketId: ticketId,
    emailData: { template: 'inventory_request', ticket_id: ticketId, remarks: remarks }
  });

  return data;
};

export const updateProcurementStatus = async (ticketId: string, newStatus: string, details?: any) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const updatePayload: any = {
    procurement_status: newStatus,
    updated_at: new Date().toISOString()
  };

  // Automatically assign ticket to Inventory Manager when procurement starts
  if (newStatus === 'Procuring') {
    updatePayload.assigned_to = userData.user.id;
  }

  if (details) {
    if (details.supplier) updatePayload.procurement_supplier = details.supplier;
    if (details.cost) updatePayload.procurement_cost = details.cost;
    if (details.expectedDate) updatePayload.procurement_expected_date = details.expectedDate;
    if (details.remarks) updatePayload.inventory_remarks = details.remarks;
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updatePayload)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: `Procurement: ${newStatus}`,
    performed_by: userData.user.id
  }]);

  // Fetch ticket details for notifications
  const { data: procTicket } = await supabase.from('tickets').select('employee_id, title, assigned_to').eq('id', ticketId).single();

  // Notify ticket requester of procurement progress
  if (procTicket?.employee_id) {
    sendNotification({
      userIds: [procTicket.employee_id],
      type: 'PROCUREMENT_UPDATE',
      title: `Procurement Update: ${newStatus}`,
      message: `Procurement for your ticket "${procTicket.title}" has been updated to: ${newStatus}.`,
      ticketId: ticketId,
      emailData: { template: 'procurement_update', ticket_title: procTicket.title, ticket_id: ticketId, new_status: newStatus }
    });
  }

  // Notify Admins of all procurement changes
  notifyAdmins({
    type: 'ADMIN_ACTION',
    title: `Procurement: ${newStatus}`,
    message: `Procurement status for ticket #${ticketId.substring(0,8)} updated to ${newStatus}.`,
    ticketId: ticketId,
    emailData: { template: 'procurement_update', ticket_id: ticketId, new_status: newStatus }
  });

  // Notify SuperAdmin if handover is pending
  if (newStatus === 'Handover Pending') {
    // Find superadmins
    const { data: superadmins } = await supabase.from('profiles').select('id').eq('role', 'superadmin');
    if (superadmins) {
      await Promise.all(superadmins.map(sa => 
        supabase.from('notifications').insert([{
          user_id: sa.id,
          type: 'INVENTORY_HANDOVER',
          title: 'Inventory Ready for Handover',
          message: `The requested part for ticket #${ticketId.substring(0,8)} is ready.`,
          severity: 'Info',
          ticket_id: ticketId
        }])
      ));
    }

    // Send email to Network Engineer (and Admin via GAS webhook)
    notifyRoles(['network_engineer'], {
      type: 'INVENTORY_HANDOVER',
      title: 'Action Required: Inventory Ready for Handover',
      message: `The requested part for ticket #${ticketId.substring(0,8)} is ready for handover. Please collect it from the Inventory Manager.`,
      ticketId: ticketId,
      emailData: {
        template: 'inventory_handover',
        ticket_id: ticketId,
        new_status: newStatus
      }
    });

    // Also notify the assigned network engineer directly
    if (procTicket?.assigned_to) {
      sendNotification({
        userIds: [procTicket.assigned_to],
        type: 'INVENTORY_HANDOVER',
        title: 'Inventory Ready for Pickup',
        message: `The part for ticket "${procTicket.title}" is ready for handover. Please collect from the Inventory Manager.`,
        ticketId: ticketId,
        emailData: { template: 'inventory_handover', ticket_id: ticketId, ticket_title: procTicket.title }
      });
    }
  }

  return data;
};

// --- DevOps Workflow API ---
export const updateDevOpsStatus = async (
  ticketId: string,
  devopsStatus: string,
  details?: { remarks?: string; error_logs?: string; screenshot_url?: string }
) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  // Fetch the current ticket to merge custom_fields
  const { data: currentTicket } = await supabase
    .from('tickets')
    .select('custom_fields, status, employee_id')
    .eq('id', ticketId)
    .single();

  const existingFields = currentTicket?.custom_fields || {};

  const mergedFields = {
    ...existingFields,
    devops_status: devopsStatus,
    devops_updated_by: userData.user.id,
    devops_updated_at: new Date().toISOString(),
    ...(details?.remarks ? { devops_remarks: details.remarks } : {}),
    ...(details?.error_logs ? { error_logs: details.error_logs } : {}),
    ...(details?.screenshot_url ? { error_screenshot: details.screenshot_url } : {}),
  };

  // Map devops status to ticket status
  const ticketStatusMap: Record<string, string> = {
    'Access Given': 'Resolved',
    'Rejected': 'Closed',
    'Deployed': 'Resolved',
    'Error': 'In Progress',
  };
  const newTicketStatus = ticketStatusMap[devopsStatus] || currentTicket?.status;

  const updatePayload: any = {
    custom_fields: mergedFields,
    status: newTicketStatus,
    updated_at: new Date().toISOString()
  };

  // REASSIGNMENT LOGIC: If error, send back to requester
  if (devopsStatus === 'Error' && currentTicket?.employee_id) {
    updatePayload.assigned_to = currentTicket.employee_id;
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updatePayload)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  // Log status history
  await supabase.from('ticket_status_history').insert([{
    ticket_id: ticketId,
    old_status: currentTicket?.status,
    new_status: newTicketStatus,
    changed_by: userData.user.id
  }]);

  // Log activity
  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: `DevOps: ${devopsStatus}${details?.remarks ? ' — ' + details.remarks : ''}`,
    performed_by: userData.user.id
  }]);

  // Notify the ticket creator
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, employee:profiles!employee_id(name, email)')
    .eq('id', ticketId)
    .single();

  if (ticket?.employee_id) {
    await supabase.from('notifications').insert([{
      user_id: ticket.employee_id,
      type: 'DEVOPS_UPDATE',
      title: `DevOps Update: ${devopsStatus}`,
      message: `Your request "${ticket.title}" has been updated to ${devopsStatus}.`,
      severity: devopsStatus === 'Error' || devopsStatus === 'Rejected' ? 'Warning' : 'Info',
      ticket_id: ticketId
    }]);

    // Send confirmation email via Webhook (already handled by specialized devops_confirmation route)
    // but we can also add a notifyAdmins here for visibility
    notifyAdmins({
      type: 'DEVOPS_UPDATE',
      title: `DevOps Action: ${devopsStatus}`,
      message: `Ticket #${ticketId.substring(0,8)} was updated by DevOps. Status: ${devopsStatus}.`,
      ticketId: ticketId,
      emailData: { template: 'devops_update_admin', ticket_title: ticket.title, ticket_id: ticketId, devops_status: devopsStatus }
    });

    // Send confirmation email via Webhook
    const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';
    if (googleWebhookUrl) {
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: 'devops_confirmation',
          ticket_id: ticketId,
          title: ticket.title,
          requester_name: ticket.employee?.name || 'User',
          requester_email: ticket.employee?.email,
          devops_status: devopsStatus,
          remarks: details?.remarks || 'No additional remarks.',
          error_logs: details?.error_logs || '',
          app_url: window.location.origin + `/tickets/${ticketId}`
        })
      }).catch(console.error);
    }
  }

  return data;
};

export const resubmitForDevOps = async (ticketId: string, remarks: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  // Fetch current ticket to get custom_fields
  const { data: ticket } = await supabase.from('tickets').select('custom_fields').eq('id', ticketId).single();
  const existingFields = ticket?.custom_fields || {};
  const lastDevOpsAgent = existingFields.devops_updated_by;

  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'Open',
      assigned_to: lastDevOpsAgent || null,
      custom_fields: {
        ...existingFields,
        devops_status: 'Resubmitted'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('activity_logs').insert([{
    ticket_id: ticketId,
    action: `User resubmitted for deployment after fixing error. ${remarks ? 'Note: ' + remarks : ''}`,
    performed_by: userData.user.id
  }]);

  // Notify DevOps Agent (Assignee)
  if (lastDevOpsAgent) {
    sendNotification({
      userIds: [lastDevOpsAgent],
      type: 'TICKET_UPDATE',
      title: 'Ticket Resubmitted',
      message: `A ticket you were handling (#${ticketId.substring(0,8)}) has been resubmitted with notes: ${remarks}`,
      ticketId: ticketId,
      emailData: { template: 'resubmission', ticket_id: ticketId, remarks: remarks }
    });
  }

  // Notify Admins
  notifyAdmins({
    type: 'TICKET_UPDATE',
    title: 'Ticket Resubmitted for DevOps',
    message: `Ticket #${ticketId.substring(0,8)} has been resubmitted by the user.`,
    ticketId: ticketId,
    emailData: { template: 'resubmission_admin', ticket_id: ticketId }
  });

  return data;
};

export const addInternalNote = async (ticketId: string, note: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('internal_notes')
    .insert([{
      ticket_id: ticketId,
      admin_id: userData.user.id,
      note
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getInternalNotes = async (ticketId: string) => {
  const { data, error } = await supabase
    .from('internal_notes')
    .select(`*, admin:admin_id(name)`)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

export const checkSLABreaches = async () => {
  const now = new Date();
  const nowIso = now.toISOString();
  
  // Find tickets that are past deadline and not closed
  const { data: overdueTickets, error } = await supabase
    .from('tickets')
    .select(`*, employee:profiles!employee_id(name)`)
    .lt('sla_deadline', nowIso)
    .not('status', 'in', '("Resolved", "Closed")');

  if (error) throw error;

  for (const ticket of overdueTickets) {
    const deadline = new Date(ticket.sla_deadline);
    const breachAgeHours = (now.getTime() - deadline.getTime()) / (1000 * 60 * 60);
    const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';

    // STAGE 1: Initial Breach (Immediate)
    if (!ticket.sla_breached) {
      await supabase.from('tickets').update({ sla_breached: true }).eq('id', ticket.id);
      
      await supabase.from('notifications').insert([{
        type: 'SLA_BREACH',
        title: 'SLA Breach Detected',
        message: `Ticket #${ticket.id.substring(0,8)} has breached its SLA.`,
        severity: 'High',
        ticket_id: ticket.id
      }]);

      if (googleWebhookUrl) {
        fetch(googleWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            type: 'sla_breach',
            id: ticket.id,
            title: ticket.title,
            name: ticket.employee?.name || ticket.guest_name || 'Guest',
            priority: ticket.priority,
            sla_deadline: ticket.sla_deadline,
            app_url: window.location.origin + `/tickets/${ticket.id}`
          })
        }).catch(console.error);
      }

      await supabase.from('activity_logs').insert([{
        ticket_id: ticket.id,
        action: 'SLA Breached (Stage 0)',
        performed_by: 'System'
      }]);
    }

    // STAGE 2: L1 Escalation (2 Hours Post-Breach)
    // Auto-escalate priority to Critical and notify admins
    if (breachAgeHours >= 2 && ticket.escalation_level < 1) {
      await supabase.from('tickets').update({ 
        escalation_level: 1,
        priority: 'Critical' 
      }).eq('id', ticket.id);

      await supabase.from('activity_logs').insert([{
        ticket_id: ticket.id,
        action: 'L1 Escalation: Priority Auto-Updated to Critical',
        performed_by: 'System'
      }]);
    }

    // STAGE 3: L2 Escalation (4 Hours Post-Breach)
    // Notify Senior Management
    if (breachAgeHours >= 4 && ticket.escalation_level < 2) {
      await supabase.from('tickets').update({ escalation_level: 2 }).eq('id', ticket.id);

      if (googleWebhookUrl) {
        fetch(googleWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            type: 'escalation_l2',
            id: ticket.id,
            title: ticket.title,
            name: ticket.employee?.name || ticket.guest_name || 'Guest',
            breach_age: Math.round(breachAgeHours),
            app_url: window.location.origin + `/tickets/${ticket.id}`
          })
        }).catch(console.error);
      }

      await supabase.from('activity_logs').insert([{
        ticket_id: ticket.id,
        action: 'L2 Escalation: Senior Management Notified',
        performed_by: 'System'
      }]);
    }
  }

  return overdueTickets;
};

export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
};

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, department, role')
    .order('name');
  if (error) throw error;
  return data;
};

export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
};

export const addComment = async (ticketId: string, comment: string, attachmentUrl?: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('ticket_comments')
    .insert([{
      ticket_id: ticketId,
      user_id: userData.user.id,
      comment,
      attachment_url: attachmentUrl
    }])
    .select()
    .single();

  if (error) throw error;

  // Notify ticket stakeholders
  const { data: ticket } = await supabase.from('tickets').select('employee_id, assigned_to, title').eq('id', ticketId).single();
  if (ticket) {
    const recipients = [ticket.employee_id, ticket.assigned_to].filter(id => id && id !== userData.user.id) as string[];
    sendNotification({
      userIds: recipients,
      type: 'NEW_COMMENT',
      title: 'New Ticket Comment',
      message: `A new comment was added to "${ticket.title}"`,
      ticketId: ticketId,
      emailData: { template: 'comment', comment_text: comment }
    });
  }

  // Notify Admins
  notifyAdmins({
    type: 'TICKET_UPDATE',
    title: 'New Comment Added',
    message: `An update was made to ticket #${ticketId.substring(0,8)}`,
    ticketId: ticketId
  });

  return data;
};

export const getAssets = async () => {
  const { data, error } = await supabase
    .from('assets')
    .select('*, assigned:profiles!assigned_to(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getActivityLogs = async (ticketId: string) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, performer:profiles!performed_by(name, email)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getAllActivityLogs = async (limit = 100) => {
  // We do a two-step fetch to handle 'System' entries where performed_by is not a UUID
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*, ticket:tickets!ticket_id(title)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Enrich with performer profile when performed_by is a valid UUID
  const enriched = await Promise.all((logs || []).map(async (log) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(log.performed_by || '');
    if (!isUUID) return { ...log, performer: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', log.performed_by)
      .single();
    return { ...log, performer: profile };
  }));

  return enriched;
};

// --- Subscriptions API ---
export const getSubscriptions = async () => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, owner:profiles!owner_id(name, email)')
    .order('next_due_date', { ascending: true });
  if (error) throw error;
  return data;
};

export const createSubscription = async (subData: any) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('subscriptions')
    .insert([{
      ...subData,
      owner_id: subData.owner_id || userData.user.id
    }])
    .select()
    .single();

  if (error) throw error;

  // Notify Admin via Webhook (Consolidated)
  const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';
  if (googleWebhookUrl) {
    // Fetch owner email for the webhook
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', data.owner_id)
      .single();

    fetch(googleWebhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({
        type: 'subscription_added',
        ...data,
        owner_name: ownerProfile?.name || 'N/A',
        owner_email: ownerProfile?.email || 'N/A'
      })
    }).catch(console.error);
  }

  // Internal In-App Notifications
  const recipients = [data.owner_id].filter(id => id && id !== userData.user.id);
  if (recipients.length > 0) {
    sendNotification({
      userIds: recipients,
      type: 'SUBSCRIPTION_UPDATE',
      title: 'New Subscription Assigned',
      message: `You have been assigned as the owner for the ${data.service_name} subscription.`,
      emailData: { template: 'subscription', service_name: data.service_name }
    });
  }

  notifyAdmins({
    type: 'SUBSCRIPTION_UPDATE',
    title: 'New Subscription Added',
    message: `A new subscription for ${data.service_name} has been added by ${userData.user.email?.split('@')[0]}.`,
  });

  return data;
};

export const updateSubscription = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // If next_due_date was updated (renewed), send a new reminder event
  if (updates.next_due_date && data.next_due_date) {
    createReminderEvent(
      `Renew Subscription: ${data.service_name}`,
      data.next_due_date,
      `Reminder to renew ${data.service_name} (${data.billing_cycle}) for ₹${data.cost}`
    );
  }

  return data;
};

// --- Leave Requests API ---
export const getLeaveRequests = async () => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, employee:profiles!employee_id(name, email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createLeaveRequest = async (leaveData: any) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('leave_requests')
    .insert([{
      ...leaveData,
      employee_id: userData.user.id,
      status: 'Pending'
    }])
    .select()
    .single();

  if (error) throw error;

  // Notify Requester
  sendNotification({
    userIds: [userData.user.id],
    type: 'LEAVE_REQUEST',
    title: 'Leave Request Submitted',
    message: `Your leave request for ${data.leave_type} (${data.start_date} to ${data.end_date}) has been submitted and is pending approval.`,
    emailData: { template: 'leave_confirmation', leave_type: data.leave_type, start_date: data.start_date, end_date: data.end_date }
  });

  // Notify Admins
  notifyAdmins({
    type: 'LEAVE_REQUEST',
    title: 'New Leave Request',
    message: `A new leave request has been submitted by ${userData.user.email?.split('@')[0]}.`,
    emailData: { template: 'leave_request', requester_name: userData.user.email?.split('@')[0] }
  });

  return data;
};

export const updateLeaveRequestStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Notify Employee (with email)
  if (data.employee_id) {
    sendNotification({
      userIds: [data.employee_id],
      type: 'LEAVE_UPDATE',
      title: `Leave Request ${status}`,
      message: `Your leave request has been ${status.toLowerCase()}.`,
      severity: status === 'Approved' ? 'Info' : 'Warning',
      emailData: { template: 'leave_update', status: status, request_id: id }
    });
  }

  // Notify Admins (with email)
  notifyAdmins({
    type: 'ADMIN_ACTION',
    title: 'Leave Request Updated',
    message: `Leave request for #${id.substring(0,8)} was ${status.toLowerCase()}.`,
    emailData: { template: 'leave_update_admin', status: status, request_id: id }
  });

  return data;
};

export const createReminderEvent = async (title: string, date: string, description: string) => {
  const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzw2_iFWH9sHWAgqM7N2ySwrLZU-qS0ftYmMD1Bc6te1uYw1h926c8SPVqACTmg4D6G/exec';
  if (googleWebhookUrl) {
    try {
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: 'calendar_event',
          title: title,
          date: date,
          description: description
        })
      }).catch(err => console.error("Event Sync Error:", err));
    } catch (e) {
      console.error("Event Sync Error:", e);
    }
  }
};
