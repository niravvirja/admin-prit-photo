
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { getGoogleAccessToken } from '../_shared/google-auth.ts';
import { 
  updateOrAppendToSheet, 
  deleteFromSheet, 
  ensureSheetExists 
} from '../_shared/google-sheets-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to get all sheet values (using shared function)
async function getSheetValues(accessToken: string, spreadsheetId: string, sheetName: string): Promise<any[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get sheet values: ${response.statusText}`);
  }

  const result = await response.json();
  return result.values || [];
}

// Helper function to get sheet ID by name (using shared function)
async function getSheetId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get spreadsheet metadata');
  }

  const spreadsheet = await response.json();
  const sheet = spreadsheet.sheets.find((s: any) => s.properties.title === sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  return sheet.properties.sheetId;
}

import { SHEET_HEADERS } from '../shared/sheet-headers.ts';

// FIXED: Helper function to calculate payment status correctly - collectedAmount is ONLY payments, not advance
function getPaymentStatus(event: any, collectedAmount: number, closedAmount: number = 0): string {
  const totalAmount = event.total_amount || 0;
  const advanceAmount = event.advance_amount || 0;
  
  // FIXED: Calculate pending correctly - Total - Advance - Collected - Closed
  const pendingAmount = totalAmount - advanceAmount - collectedAmount - closedAmount;
  
  // PAID: Pending amount is 0 or negative
  if (pendingAmount <= 0) return 'Paid';
  // PARTIAL: Some payment made but balance still exists
  if (collectedAmount > 0 || advanceAmount > 0) return 'Partial';
  // PENDING: No payment made
  return 'Pending';
}

// Add single client to Google Sheets (WITH CLIENT ID - FIXED HEADER ORDER)
async function addClientToSheet(supabase: any, accessToken: string, spreadsheetId: string, clientId: string) {
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !client) {
    throw new Error(`Client not found: ${error?.message}`);
  }

  // Client data to match EXACT CENTRALIZED headers: ['Client ID', 'Client Name', 'Phone Number', 'Email', 'Address / City', 'Remarks / Notes']
  const clientData = [
    client.id,                   // Client ID - FOR MATCHING/COMPARING
    client.name,                 // Client Name
    client.phone,                // Phone Number  
    client.email || '',          // Email
    client.address || '',        // Address / City
    client.notes || ''           // Remarks / Notes
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Clients', clientData, 0); // Match by Client ID (index 0)
  console.log(`✅ Synced client ${client.name} to Google Sheets`);
  return client;
}

  // ENHANCED EVENT SYNC - with multi-day support and staff assignments
async function addEventToSheet(supabase: any, accessToken: string, spreadsheetId: string, eventId: string) {
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      clients(id, name)
    `)
    .eq('id', eventId)
    .single();

  console.log(`✅ Event found: ${event?.title || event?.clients?.name || 'Unknown'}`);

  if (error || !event) {
    throw new Error(`Event not found: ${error?.message}`);
  }

  // Fetch payments for this event to calculate collected amount
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('amount')
    .eq('event_id', eventId)
    .eq('firm_id', event.firm_id);

  if (paymentError) {
    console.error('Error fetching payments:', paymentError);
  }

  // Fetch closing balances for this event
  const { data: closingBalances, error: closingError } = await supabase
    .from('event_closing_balances')
    .select('closing_amount')
    .eq('event_id', eventId)
    .eq('firm_id', event.firm_id);

  if (closingError) {
    console.error('Error fetching closing balances:', closingError);
  }

  // FIXED: Calculate payment amounts correctly
  const paymentsOnlyTotal = payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
  const advanceAmount = Number(event.advance_amount || 0);
  // Collected = ONLY payments made after advance (not including advance)
  const collectedAmount = paymentsOnlyTotal;
  
  // Calculate total closed amount
  const closedAmount = closingBalances?.reduce((sum, closing) => sum + Number(closing.closing_amount || 0), 0) || 0;
  
  console.log(`💰 Total closed for event: ₹${closedAmount}`);
  console.log(`💰 Total collected for event: ₹${collectedAmount} (Advance: ₹${advanceAmount} + Payments: ₹${paymentsOnlyTotal})`);
  
  // Payment calculations completed

  // Get staff assignments for this event with proper freelancer support
  const { data: staffAssignments } = await supabase
    .from('event_staff_assignments')
    .select('*')
    .eq('event_id', eventId);

  // Get staff and freelancer details separately to avoid join issues
  let staffProfiles = [];
  let freelancerProfiles = [];
  
  if (staffAssignments && staffAssignments.length > 0) {
    const staffIds = staffAssignments.filter(a => a.staff_id).map(a => a.staff_id);
    const freelancerIds = staffAssignments.filter(a => a.freelancer_id).map(a => a.freelancer_id);
    
    if (staffIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', staffIds);
      staffProfiles = profiles || [];
    }
    
    if (freelancerIds.length > 0) {
      const { data: freelancers } = await supabase
        .from('freelancers')
        .select('id, full_name')
        .in('id', freelancerIds);
      freelancerProfiles = freelancers || [];
    }
  }

  // Group staff by role and day with ENHANCED multi-staff support for comma separation - FIXED: Added drone and same day editors
  const photographersByDay: { [key: number]: string[] } = {};
  const cinematographersByDay: { [key: number]: string[] } = {};
  const dronePilotsByDay: { [key: number]: string[] } = {};
  const sameDayEditorsByDay: { [key: number]: string[] } = {};

  console.log(`📋 Found ${staffAssignments?.length || 0} staff assignments for event`);

  if (staffAssignments && staffAssignments.length > 0) {
    staffAssignments.forEach(assignment => {
      const day = assignment.day_number || 1;
      
      // Get staff name from either staff or freelancer
      let staffName = '';
      if (assignment.staff_type === 'staff' && assignment.staff_id) {
        const profile = staffProfiles.find(p => p.id === assignment.staff_id);
        staffName = profile?.full_name || 'Unknown Staff';
      } else if (assignment.staff_type === 'freelancer' && assignment.freelancer_id) {
        const freelancer = freelancerProfiles.find(f => f.id === assignment.freelancer_id);
        staffName = freelancer?.full_name || 'Unknown Freelancer';
      }
      
      console.log(`👤 Staff assignment - Day ${day}: ${assignment.role} -> ${staffName} (${assignment.staff_type})`);
      
      if (assignment.role === 'Photographer' && staffName) {
        if (!photographersByDay[day]) photographersByDay[day] = [];
        // Prevent duplicates - only add if not already in the array
        if (!photographersByDay[day].includes(staffName)) {
          photographersByDay[day].push(staffName);
        }
      } else if (assignment.role === 'Cinematographer' && staffName) {
        if (!cinematographersByDay[day]) cinematographersByDay[day] = [];
        // Prevent duplicates - only add if not already in the array
        if (!cinematographersByDay[day].includes(staffName)) {
          cinematographersByDay[day].push(staffName);
        }
      } else if (assignment.role === 'Drone Pilot' && staffName) {
        if (!dronePilotsByDay[day]) dronePilotsByDay[day] = [];
        // Prevent duplicates - only add if not already in the array
        if (!dronePilotsByDay[day].includes(staffName)) {
          dronePilotsByDay[day].push(staffName);
        }
      } else if (assignment.role === 'Same Day Editor' && staffName) {
        if (!sameDayEditorsByDay[day]) sameDayEditorsByDay[day] = [];
        // Prevent duplicates - only add if not already in the array
        if (!sameDayEditorsByDay[day].includes(staffName)) {
          sameDayEditorsByDay[day].push(staffName);
        }
      }
    });
  }

  // Calculate total days (use total_days from event or calculate from dates)
  const totalDays = event.total_days || 1;
  const eventDate = new Date(event.event_date);
  
  // Create entries for each day
  for (let day = 1; day <= totalDays; day++) {
    // Calculate the date for this day
    const currentDate = new Date(eventDate);
    currentDate.setDate(eventDate.getDate() + (day - 1));
    const dayDateString = currentDate.toISOString().split('T')[0];
    
    // Get photographers and cinematographers for this specific day
    const dayPhotographers = photographersByDay[day] || [];
    const dayCinematographers = cinematographersByDay[day] || [];
    const dayDronePilots = dronePilotsByDay[day] || [];
    const daySameDayEditors = sameDayEditorsByDay[day] || [];
    
    // ENHANCED logging for debugging with comma separation
    const photographersText = dayPhotographers.join(', ');
    const cinematographersText = dayCinematographers.join(', ');
    const droneText = dayDronePilots.join(', ');
    const sameDayEditorsText = daySameDayEditors.join(', ');
    
    console.log(`📅 Day ${day} - Photographers: ${photographersText || 'None'}`);
    console.log(`📅 Day ${day} - Cinematographers: ${cinematographersText || 'None'}`);
    console.log(`📅 Day ${day} - Drone Pilots: ${droneText || 'None'}`);
    console.log(`📅 Day ${day} - Same Day Editors: ${sameDayEditorsText || 'None'}`);

    // Create day-specific event title - FIXED: Use actual event title
    const dayTitle = totalDays > 1 
      ? `${event.title || event.clients?.name || 'Unknown Event'} - DAY ${day.toString().padStart(2, '0')}`
      : event.title || event.clients?.name || 'Unknown Event';

    // Create unique event key for this day
    const eventKey = totalDays > 1 ? `${event.id}-day${day}` : event.id;
    
    // FIXED: Calculate balance correctly (total - advance - collected - closed)
    const balanceAmount = Math.max(0, (event.total_amount || 0) - advanceAmount - collectedAmount - closedAmount);
    
    const eventData = [
      eventKey,                                          // 0 - Event ID (PRIMARY IDENTIFIER) 
      dayTitle,                                          // 1 - Event Title (not client name) 
      event.event_type,                                  // 2 - Event Type
      dayDateString,                                     // 3 - Event Date (adjusted for day)
      event.venue || '',                                 // 4 - Location / Venue
      event.storage_disk || '',                          // 5 - Storage Disk
      event.storage_size ? event.storage_size.toString() : '', // 6 - Storage Size
      photographersText,                                 // 7 - Assigned Photographer(s) - COMMA SEPARATED
      cinematographersText,                              // 8 - Assigned Cinematographer(s) - COMMA SEPARATED
      droneText,                                         // 9 - Drone Pilot(s) - COMMA SEPARATED 
      sameDayEditorsText,                                // 10 - Same Day Editor(s) - COMMA SEPARATED 
      event.created_at.split('T')[0],                    // 11 - Booking Date
      Number(event.advance_amount || 0),                 // 12 - Advance Amount (ensure number)
      Number(collectedAmount),                           // 13 - Collected Amount (FIXED: advance + payments)
      Number(closedAmount),                              // 14 - Closed Amount (NEW: from event_closing_balances)
      Number(balanceAmount),                             // 15 - Balance Amount (FIXED: total - collected - closed)
      Number(event.total_amount || 0),                   // 16 - Total Amount (ensure number)
      getPaymentStatus(event, collectedAmount, closedAmount), // 17 - Payment Status (FIXED: includes closed amount)
      event.photo_editing_status ? 'Yes' : 'No',        // 18 - Photos Edited
      event.video_editing_status ? 'Yes' : 'No',        // 19 - Videos Edited
      `Day ${day}/${totalDays}${event.description ? ` - ${event.description}` : ''}` // 20 - Remarks / Notes
    ];

    // Sync to Master Events sheet using EVENT ID + day as unique key
    await updateOrAppendToSheet(accessToken, spreadsheetId, 'Master Events', eventData, 0); // Match by Event ID (index 0)
    console.log(`✅ Synced event ${dayTitle} to Master Events sheet`);

    // Also sync to event-specific type sheet using exact event type as sheet name
    try {
      const sheetName = event.event_type; // Use event type directly as sheet name
      console.log(`🎯 Event type "${event.event_type}" → Sheet name "${sheetName}"`);
      await updateOrAppendToSheet(accessToken, spreadsheetId, sheetName, eventData, 0); // Match by Event ID (index 0)
      console.log(`✅ Also synced event to ${sheetName} sheet`);
    } catch (eventTypeError) {
      console.warn(`⚠️ Could not sync to event-specific sheet "${event.event_type}": ${eventTypeError.message}`);
    }
  }

  return event;
}

// Add single task to Google Sheets - FIXED HEADER ORDER
async function addTaskToSheet(supabase: any, accessToken: string, spreadsheetId: string, taskId: string) {
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_profile:profiles!tasks_assigned_to_fkey(full_name),
      freelancer:freelancers!tasks_freelancer_id_fkey(full_name),
      event:events(title, event_date, clients(id, name))
    `)
    .eq('id', taskId)
    .single();

  if (error || !task) {
    throw new Error(`Task not found: ${error?.message}`);
  }

  // Determine assignment with proper brackets
  let assignedTo = 'Unassigned';
  if (task.assigned_profile?.full_name) {
    assignedTo = `${task.assigned_profile.full_name} (STAFF)`;
  } else if (task.freelancer?.full_name) {
    assignedTo = `${task.freelancer.full_name} (FREELANCER)`;
  }

  // Task data to match EXACT CENTRALIZED headers: ['Task ID', 'Title', 'Assigned To', 'Client', 'Event', 'Date', 'Type', 'Description', 'Due Date', 'Status', 'Priority', 'Amount', 'Updated', 'Remarks']
  const taskData = [
    task.id,                                           // Task ID
    task.title,                                        // Title
    assignedTo,                                        // Assigned To
    task.event?.clients?.name || '',                   // Client
    task.event?.title || '',                           // Event
    task.event?.event_date || '',                      // Date
    task.task_type || 'Other',                         // Type
    task.description || '',                            // Description
    task.due_date || '',                               // Due Date
    task.status,                                       // Status
    task.priority || 'Medium',                         // Priority
    task.amount || '',                                 // Amount - CRITICAL FIELD ADDED
    task.updated_at.split('T')[0],                     // Updated
    ''                                                 // Remarks
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Tasks', taskData, 0); // Match by Task ID (index 0)
  console.log(`✅ Synced task ${task.title} to Google Sheets`);
  return task;
}

// Add single expense to Google Sheets - FIXED HEADER ORDER
async function addExpenseToSheet(supabase: any, accessToken: string, spreadsheetId: string, expenseId: string) {
  const { data: expense, error } = await supabase
    .from('expenses')
    .select(`
      *,
      event:events(title)
    `)
    .eq('id', expenseId)
    .single();

  if (error || !expense) {
    throw new Error(`Expense not found: ${error?.message}`);
  }

  // Extract person name from salary expense description
  let vendor = 'N/A';
  if (expense.category === 'Salary' && expense.description) {
    // Extract name from descriptions like "Staff payment to John Doe" or "Freelancer payment to Jane Smith"
    const matches = expense.description.match(/(?:Staff|Freelancer) payment to (.+)/i);
    if (matches && matches[1]) {
      vendor = matches[1].trim();
    }
  }

  // Expense data to match EXACT CENTRALIZED headers: ['Expense ID', 'Date', 'Category', 'Vendor', 'Description', 'Amount', 'Payment Method', 'Event', 'Receipt', 'Remarks']
  const expenseData = [
    expense.id,                                        // Expense ID
    expense.expense_date,                              // Date
    expense.category,                                  // Category
    vendor,                                            // Vendor - extract from salary descriptions
    expense.description,                               // Description
    expense.amount,                                    // Amount
    expense.payment_method || 'Cash',                  // Payment Method
    expense.event?.title || '',                        // Event
    expense.receipt_url ? 'Yes' : 'No',               // Receipt
    expense.notes || ''                                // Remarks
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Expenses', expenseData, 0); // Match by Expense ID (index 0)
  console.log(`✅ Synced expense ${expense.description} to Google Sheets`);
  return expense;
}

// Add single staff to Google Sheets - FIXED HEADER ORDER
async function addStaffToSheet(supabase: any, accessToken: string, spreadsheetId: string, staffId: string) {
  const { data: staff, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', staffId)
    .single();

  if (error || !staff) {
    throw new Error(`Staff not found: ${error?.message}`);
  }

  // Check if staff already exists in sheet by staff ID to prevent duplicates
  const existingData = await getSheetValues(accessToken, spreadsheetId, 'Staff');
  const staffExists = existingData.some((row: any[], index: number) => {
    // Skip header row and check staff ID column (first column)
    return index > 0 && row.length > 0 && row[0] === staff.id;
  });

  if (staffExists) {
    console.log(`⚠️ Staff ${staff.full_name} already exists in sheet, skipping duplicate`);
    return staff;
  }

  // Staff data to match EXACT CENTRALIZED headers: ['Staff ID', 'Full Name', 'Role', 'Mobile Number', 'Join Date', 'Remarks']
  const staffData = [
    staff.id,                                              // Staff ID
    staff.full_name,                                       // Full Name
    staff.role,                                            // Role
    staff.mobile_number,                                   // Mobile Number
    staff.created_at.split('T')[0],                        // Join Date
    ''                                                     // Remarks
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Staff', staffData, 0); // Match by Staff ID (index 0)
  console.log(`✅ Synced staff ${staff.full_name} to Google Sheets`);
  return staff;
}

// Add single freelancer to Google Sheets - FIXED HEADER ORDER
async function addFreelancerToSheet(supabase: any, accessToken: string, spreadsheetId: string, freelancerId: string) {
  const { data: freelancer, error } = await supabase
    .from('freelancers')
    .select('*')
    .eq('id', freelancerId)
    .single();

  if (error || !freelancer) {
    throw new Error(`Freelancer not found: ${error?.message}`);
  }

  // Remove duplicate check - updateOrAppendToSheet handles updates properly

  // Freelancer data to match EXACT CENTRALIZED headers: ['Freelancer ID', 'Name', 'Role', 'Phone', 'Email', 'Rate', 'Remarks']
  const freelancerData = [
    freelancer.id,                                         // Freelancer ID
    freelancer.full_name,                                  // Name
    freelancer.role,                                       // Role
    freelancer.phone || '',                                // Phone
    freelancer.email || '',                                // Email
    freelancer.rate || 0,                                  // Rate
    ''                                                     // Remarks
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Freelancers', freelancerData, 0); // Match by Freelancer ID (index 0)
  console.log(`✅ Synced freelancer ${freelancer.full_name} to Google Sheets`);
  return freelancer;
}

// Add single accounting entry to Google Sheets - NEW FUNCTION
async function addAccountingToSheet(supabase: any, accessToken: string, spreadsheetId: string, entryId: string) {
  const { data: entry, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (error || !entry) {
    throw new Error(`Accounting entry not found: ${error?.message}`);
  }

  // Accounting data to match EXACT CENTRALIZED headers: ['Entry ID', 'Entry Type', 'Category', 'Subcategory', 'Title', 'Description', 'Amount', 'Entry Date', 'Payment Method', 'Document URL', 'Reflect to Company', 'Created Date']
  const accountingData = [
    entry.id,                                              // Entry ID
    entry.entry_type,                                      // Entry Type (Credit/Debit)
    entry.category,                                        // Category
    entry.subcategory || '',                               // Subcategory
    entry.title,                                           // Title
    entry.description || '',                               // Description
    entry.amount,                                          // Amount
    entry.entry_date,                                      // Entry Date
    entry.payment_method || 'Cash',                        // Payment Method
    entry.document_url || '',                              // Document URL
    entry.reflect_to_company ? 'Yes' : 'No',              // Reflect to Company
    entry.created_at.split('T')[0]                         // Created Date
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Accounting', accountingData, 0); // Match by Entry ID (index 0)
  console.log(`✅ Synced accounting entry ${entry.title} to Google Sheets`);
  return entry;
}

// Add single payment to Google Sheets
async function addPaymentToSheet(supabase: any, accessToken: string, spreadsheetId: string, paymentId: string) {
  // First get the payment
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentError?.message}`);
  }

  // Then get the event separately to avoid relationship issues
  let eventTitle = 'Unknown Event';
  let clientName = 'Unknown Client';
  
  if (payment.event_id) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        title,
        clients(name)
      `)
      .eq('id', payment.event_id)
      .single();
    
    if (event && !eventError) {
      eventTitle = event.title || 'Unknown Event';
      clientName = event.clients?.name || 'Unknown Client';
    }
  }
  
  // Payment data to match headers: ['Payment ID', 'Event', 'Client', 'Amount', 'Payment Method', 'Payment Date', 'Reference Number', 'Notes', 'Created Date']
  const paymentData = [
    payment.id,                                           // Payment ID
    eventTitle,                                           // Event
    clientName,                                           // Client
    payment.amount || 0,                                  // Amount
    payment.payment_method || 'Cash',                     // Payment Method
    payment.payment_date || new Date().toISOString().split('T')[0], // Payment Date
    payment.reference_number || '',                       // Reference Number
    payment.notes || '',                                  // Notes
    payment.created_at?.split('T')[0] || new Date().toISOString().split('T')[0] // Created Date
  ];

  await updateOrAppendToSheet(accessToken, spreadsheetId, 'Payments', paymentData, 0); // Match by Payment ID (index 0)
  console.log(`✅ Synced payment ₹${payment.amount} for ${eventTitle} to Google Sheets`);
  return payment;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 Starting AUTOMATIC single item sync to Google Sheets...');
    const { itemType, itemId, firmId } = await req.json();
    
    if (!itemType || !itemId || !firmId) {
      console.error('❌ Missing required parameters');
      return new Response(JSON.stringify({
        success: false,
        error: 'itemType, itemId, and firmId are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get firm details
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    if (firmError || !firm || !firm.spreadsheet_id) {
      console.error('❌ Firm not found or no spreadsheet configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Firm not found or no Google Spreadsheet configured'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Google authentication
    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken();
      console.log('✅ Google authentication successful');
    } catch (error) {
      console.error('❌ Google authentication failed:', error.message);
      return new Response(JSON.stringify({
        success: false,
        error: `Google authentication failed: ${error.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let syncedItem;
    let message = '';

    // Sync based on item type
    switch (itemType) {
      case 'client':
        // Ensure Clients sheet exists with proper headers
        await ensureSheetExists(accessToken, firm.spreadsheet_id, 'Clients', SHEET_HEADERS.CLIENTS);
        
        syncedItem = await addClientToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Client "${syncedItem.name}" automatically synced to Google Sheets`;
        break;
      
      case 'event':
        // Ensure Master Events sheet exists with proper headers
        await ensureSheetExists(accessToken, firm.spreadsheet_id, 'Master Events', SHEET_HEADERS.MASTER_EVENTS);
        
        syncedItem = await addEventToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Event "${syncedItem.title || syncedItem.clients?.name || 'Unknown'}" automatically synced to Google Sheets`;
        break;
      
      case 'task':
        // Ensure Tasks sheet exists with proper headers
        await ensureSheetExists(accessToken, firm.spreadsheet_id, 'Tasks', SHEET_HEADERS.TASKS);
        
        syncedItem = await addTaskToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Task "${syncedItem.title}" automatically synced to Google Sheets`;
        break;
      
      case 'expense':
        // Ensure Expenses sheet exists with proper headers
        await ensureSheetExists(accessToken, firm.spreadsheet_id, 'Expenses', SHEET_HEADERS.EXPENSES);
        
        syncedItem = await addExpenseToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Expense "${syncedItem.description}" automatically synced to Google Sheets`;
        break;
      
      case 'staff':
        syncedItem = await addStaffToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Staff "${syncedItem.full_name}" automatically synced to Google Sheets`;
        break;
      
      case 'freelancer':
        syncedItem = await addFreelancerToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Freelancer "${syncedItem.full_name}" automatically synced to Google Sheets`;
        break;
      
      case 'payment':
        syncedItem = await addPaymentToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Payment ₹${syncedItem.amount} for "${syncedItem.events?.title}" automatically synced to Google Sheets`;
        break;
      
      case 'accounting':
        // Ensure Accounting sheet exists with proper headers
        await ensureSheetExists(accessToken, firm.spreadsheet_id, 'Accounting', SHEET_HEADERS.ACCOUNTING);
        
        syncedItem = await addAccountingToSheet(supabase, accessToken, firm.spreadsheet_id, itemId);
        message = `Accounting entry "${syncedItem.title}" automatically synced to Google Sheets`;
        break;
      
      default:
        throw new Error(`Unsupported item type: ${itemType}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message,
      syncedItem,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${firm.spreadsheet_id}/edit`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
