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
  'superadmin': Object.values(PERMISSIONS)
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

  const { data, error } = await supabase
    .from('tickets')
    .insert([{
      title,
      description,
      issue_type,
      sub_type,
      priority,
      status: 'Open',
      employee_id: targetEmployeeId,
      guest_name: targetEmployeeId ? null : guest_name,
      guest_email: targetEmployeeId ? null : guest_email,
      department: employeeDept,
      device_id,
      is_blocked: is_blocked || false,
      issue_start_date: issue_start_date || null,
      frequency: frequency || null,
      sla_deadline: sla_deadline.toISOString()
    }])
    .select()
    .single();

  if (error) throw error;
  
  // Log activity
  await supabase.from('activity_logs').insert([{
    ticket_id: data.id,
    action: 'Ticket created',
    performed_by: userData.user.id
  }]);

  // Sync to Google Sheets
  const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL;
  if (googleWebhookUrl) {
    console.log(`Syncing ticket "${data.title}" to Google Sheets...`);
    try {
      // Don't await the fetch so we don't block the UI returning the ticket
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Critical for Google Apps Script redirects
        body: JSON.stringify({
          type: 'ticket',
          name: ticketData.name || '',
          email: ticketData.email || '',
          department: ticketData.department || '',
          title: data.title,
          description: data.description,
          issue_type: data.issue_type,
          sub_type: data.sub_type || 'General',
          priority: data.priority,
          is_blocked: data.is_blocked,
          issue_start_date: data.issue_start_date,
          frequency: data.frequency
        })
      }).catch(err => console.error("Sheet Sync Error:", err));
    } catch (err) {
      console.error("Sheet Sync Error:", err);
    }
  } else {
    console.warn("VITE_GOOGLE_WEBHOOK_URL is not set in .env");
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

  return data;
};

// Ticket Status State Machine
export const VALID_TRANSITIONS: Record<string, string[]> = {
  'Open': ['Assigned', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'],
  'Assigned': ['In Progress', 'Waiting for User', 'Resolved', 'Closed'],
  'In Progress': ['Waiting for User', 'Resolved', 'Closed'],
  'Waiting for User': ['In Progress', 'Resolved', 'Closed'],
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

  const { data, error } = await supabase
    .from('tickets')
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    })
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
  const now = new Date().toISOString();
  
  // Find tickets where SLA deadline has passed and status is not 'Resolved' or 'Closed'
  const { data: breachedTickets, error } = await supabase
    .from('tickets')
    .select(`*, employee:employee_id(name)`)
    .lt('sla_deadline', now)
    .not('status', 'in', '("Resolved", "Closed")')
    .eq('sla_breached', false); // Only get those not already marked

  if (error) throw error;

  for (const ticket of breachedTickets) {
    // Mark as breached
    await supabase.from('tickets').update({ sla_breached: true }).eq('id', ticket.id);

    // Create Notification for Admins/SuperAdmins
    await supabase.from('notifications').insert([{
      type: 'SLA_BREACH',
      title: 'SLA Breach Detected',
      message: `Ticket ${ticket.id} (${ticket.title}) from ${ticket.employee?.name || 'Guest'} has breached its SLA target.`,
      severity: 'Critical',
      ticket_id: ticket.id
    }]);

    // Send Email via Webhook
    const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL;
    if (googleWebhookUrl) {
      fetch(googleWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: 'sla_breach',
          id: ticket.id,
          title: ticket.title,
          name: ticket.employee?.name || 'Guest',
          priority: ticket.priority,
          sla_deadline: ticket.sla_deadline,
          app_url: window.location.origin + `/tickets/${ticket.id}`
        })
      }).catch(console.error);
    }

    // Log in Activity
    await supabase.from('activity_logs').insert([{
      ticket_id: ticket.id,
      action: 'SLA Breached',
      performed_by: 'System'
    }]);
  }

  return breachedTickets;
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
    .select('id, name, email, department')
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
