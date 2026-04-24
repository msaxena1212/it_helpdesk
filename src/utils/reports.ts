import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Report') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToCSV = (data: any[], fileName: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => `"${val}"`).join(',')
  ).join('\n');
  
  const csvContent = `${headers}\n${rows}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateTicketReport = (tickets: any[]) => {
  return tickets.map(t => ({
    'Ticket ID': t.id,
    'Title': t.title,
    'Employee': t.employee?.name || 'N/A',
    'Department': t.employee?.department || 'N/A',
    'Issue Type': t.issue_type,
    'Priority': t.priority,
    'Status': t.status,
    'Created At': new Date(t.created_at).toLocaleString(),
    'Resolved At': t.resolved_at ? new Date(t.resolved_at).toLocaleString() : 'Open',
    'Admin': t.assigned?.name || 'Unassigned',
    'SLA Met': t.sla_breached ? 'No' : 'Yes'
  }));
};
