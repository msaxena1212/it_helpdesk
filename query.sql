select id, title, status, procurement_status from tickets where status = 'Waiting for Inventory' or procurement_status is not null;
