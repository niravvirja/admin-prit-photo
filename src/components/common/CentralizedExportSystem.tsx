import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Filter, Search, Calendar, Users, DollarSign, FileSpreadsheet } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Export configurations for all modules
export interface ExportModule {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  pdfTypes: PDFType[];
  filterOptions: FilterOption[];
}

export interface PDFType {
  id: string;
  name: string;
  description: string;
  requiresDateRange?: boolean;
  requiresEntitySelection?: boolean;
  entityType?: 'event' | 'client' | 'staff' | 'freelancer';
}

export interface FilterOption {
  id: string;
  name: string;
  type: 'select' | 'multiselect' | 'daterange' | 'search';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// Module configurations
export const EXPORT_MODULES: ExportModule[] = [
  {
    id: 'clients',
    name: 'Clients',
    icon: Users,
    description: 'Client reports and contact lists',
    pdfTypes: [
      { id: 'all_clients', name: 'All Clients PDF', description: 'Complete client list with contact details' },
      { id: 'event_wise_clients', name: 'Event-wise Clients PDF', description: 'Clients grouped by events', requiresEntitySelection: true, entityType: 'event' }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search clients...' },
      { id: 'event_filter', name: 'Filter by Event', type: 'select' }
    ]
  },
  {
    id: 'quotations',
    name: 'Quotations',
    icon: FileText,
    description: 'Quotation reports and status summaries',
    pdfTypes: [
      { id: 'all_quotations', name: 'All Quotations PDF', description: 'Complete quotation list' },
      { id: 'upcoming_quotations', name: 'Upcoming Quotations PDF', description: 'Quotations with future event dates' },
      { id: 'event_wise_quotations', name: 'Event-wise Quotations PDF', description: 'Quotations grouped by events', requiresEntitySelection: true, entityType: 'event' }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search quotations...' },
      { id: 'status', name: 'Status', type: 'select', options: [
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'past', label: 'Past' },
        { value: 'all', label: 'All' }
      ]},
      { id: 'event_filter', name: 'Filter by Event', type: 'select' }
    ]
  },
  {
    id: 'events',
    name: 'Events',
    icon: Calendar,
    description: 'Event reports with payments and crew details',
    pdfTypes: [
      { id: 'all_events', name: 'All Events PDF', description: 'Complete events with payments and crew' },
      { id: 'staff_incomplete', name: 'Staff Incomplete Events PDF', description: 'Events with incomplete staff assignments' },
      { id: 'upcoming_events', name: 'Upcoming Events PDF', description: 'Future events' },
      { id: 'completed_events', name: 'Completed Events PDF', description: 'Past completed events' },
      { id: 'pending_payments', name: 'Pending Payments PDF', description: 'Events with outstanding payments' },
      { id: 'pending_tasks', name: 'Pending Tasks PDF', description: 'Events with pending tasks' },
      { id: 'custom_range', name: 'Custom Date Range Events PDF', description: 'Events within specified date range', requiresDateRange: true },
      { id: 'individual_event', name: 'Event-wise Reports PDF', description: 'Individual event detailed report', requiresEntitySelection: true, entityType: 'event' }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search events...' },
      { id: 'staff_status', name: 'Staff Status', type: 'select', options: [
        { value: 'completed', label: 'Completed' },
        { value: 'incomplete', label: 'Incomplete' }
      ]},
      { id: 'date_filter', name: 'Date Filter', type: 'select', options: [
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'past', label: 'Past' },
        { value: 'custom', label: 'Custom Range' }
      ]},
      { id: 'payment_status', name: 'Payment Status', type: 'select', options: [
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Pending' }
      ]},
      { id: 'task_status', name: 'Task Status', type: 'select', options: [
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' }
      ]}
    ]
  },
  {
    id: 'tasks',
    name: 'Tasks',
    icon: FileSpreadsheet,
    description: 'Task reports and assignment details',
    pdfTypes: [
      { id: 'all_tasks', name: 'All Tasks PDF', description: 'Complete task list with details' },
      { id: 'task_status', name: 'Task Status PDF', description: 'Tasks grouped by status' },
      { id: 'member_wise', name: 'Member-wise Tasks PDF', description: 'Tasks grouped by assigned members' },
      { id: 'retasked', name: 'Retasked/Changed Tasks PDF', description: 'Tasks that were reassigned or modified' },
      { id: 'staff_vs_freelancer', name: 'Staff vs Freelancer Tasks PDF', description: 'Task distribution comparison' }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search tasks...' },
      { id: 'status', name: 'Status', type: 'select', options: [
        { value: 'completed', label: 'Completed' },
        { value: 'incomplete', label: 'Incomplete' },
        { value: 'in_progress', label: 'In Progress' }
      ]},
      { id: 'assigned_member', name: 'Assigned Member', type: 'select', options: [
        { value: 'staff', label: 'Staff' },
        { value: 'freelancer', label: 'Freelancer' }
      ]},
      { id: 'task_type', name: 'Task Type', type: 'select', options: [
        { value: 'retasked', label: 'Retasked' },
        { value: 'changed', label: 'Changed' }
      ]}
    ]
  },
  {
    id: 'salary',
    name: 'Salary',
    icon: DollarSign,
    description: 'Salary and payment reports',
    pdfTypes: [
      { id: 'all_freelancers', name: 'All Freelancers PDF', description: 'Freelancer payment details' },
      { id: 'all_staff', name: 'All Staff PDF', description: 'Staff payment details' },
      { id: 'individual_member', name: 'Individual Member Salary PDF', description: 'Detailed member report', requiresEntitySelection: true, entityType: 'staff' },
      { id: 'role_wise', name: 'Role-wise Salary PDF', description: 'Salary grouped by roles' },
      { id: 'paid_salary', name: 'Paid Salary PDF', description: 'Completed salary payments' },
      { id: 'unpaid_salary', name: 'Unpaid Salary PDF', description: 'Pending salary payments' },
      { id: 'pending_salary', name: 'Pending Salary PDF', description: 'Outstanding salary obligations' },
      { id: 'salary_linked_tasks', name: 'Salary-linked Pending Tasks PDF', description: 'Tasks affecting salary calculations' }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search members...' },
      { id: 'member_type', name: 'Member Type', type: 'select', options: [
        { value: 'staff', label: 'Staff' },
        { value: 'freelancer', label: 'Freelancer' },
        { value: 'specific', label: 'Specific Person' }
      ]},
      { id: 'role', name: 'Role', type: 'select' },
      { id: 'payment_status', name: 'Payment Status', type: 'select', options: [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'pending', label: 'Pending' }
      ]}
    ]
  },
  {
    id: 'expenses',
    name: 'Expenses',
    icon: FileText,
    description: 'Expense reports and categorized spending',
    pdfTypes: [
      { id: 'all_expenses', name: 'All Expenses PDF', description: 'Complete expense list with details' },
      { id: 'category_wise', name: 'Category-wise Expenses PDF', description: 'Expenses grouped by category' },
      { id: 'event_wise', name: 'Event-wise Expenses PDF', description: 'Expenses linked to specific events' },
      { id: 'monthly', name: 'Monthly Expenses PDF', description: 'Monthly expense breakdown', requiresDateRange: true },
      { id: 'yearly', name: 'Yearly Expenses PDF', description: 'Annual expense summary', requiresDateRange: true }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search expenses...' },
      { id: 'category', name: 'Category', type: 'select', options: [
        { value: 'equipment', label: 'Equipment' },
        { value: 'travel', label: 'Travel' },
        { value: 'food', label: 'Food' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'other', label: 'Other' }
      ]},
      { id: 'event_filter', name: 'Filter by Event', type: 'select' },
      { id: 'date_range', name: 'Date Range', type: 'daterange' }
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: DollarSign,
    description: 'Financial reports and revenue analysis',
    pdfTypes: [
      { id: 'all_payments', name: 'All Payments PDF', description: 'Complete payment history (In & Out)' },
      { id: 'cash_in', name: 'Cash In PDF', description: 'Cash receipts and income' },
      { id: 'digital_payments', name: 'Digital Payments PDF', description: 'Digital transaction history' },
      { id: 'pending_amounts', name: 'Pending Amounts PDF', description: 'Outstanding receivables' },
      { id: 'closed_amounts', name: 'Closed Amounts PDF', description: 'Completed transactions' },
      { id: 'revenue_report', name: 'Revenue Report PDF', description: 'Income analysis and trends' },
      { id: 'profit_loss', name: 'Profit & Loss Report PDF', description: 'P&L statement', requiresDateRange: true },
      { id: 'full_financial', name: 'Full Financial Report PDF', description: 'Comprehensive financial overview', requiresDateRange: true }
    ],
    filterOptions: [
      { id: 'search', name: 'Search', type: 'search', placeholder: 'Search transactions...' },
      { id: 'payment_type', name: 'Type', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'digital', label: 'Digital' },
        { value: 'all', label: 'All' }
      ]},
      { id: 'status', name: 'Status', type: 'select', options: [
        { value: 'pending', label: 'Pending' },
        { value: 'closed', label: 'Closed' }
      ]},
      { id: 'date_range', name: 'Date Range', type: 'daterange' },
      { id: 'event_filter', name: 'Filter by Event', type: 'select' }
    ]
  },
  {
    id: 'accounts',
    name: 'Accounts',
    icon: DollarSign,
    description: 'Financial statements and accounting reports',
    pdfTypes: [
      { id: 'balance_sheet', name: 'Balance Sheet PDF', description: 'Complete financial position statement with assets, liabilities, and equity' },
      { id: 'profit_loss', name: 'Profit & Loss Statement PDF', description: 'Income statement showing revenue, expenses, and net profit', requiresDateRange: true },
      { id: 'cash_flow', name: 'Cash Flow Statement PDF', description: 'Cash inflows and outflows across operating, investing, and financing', requiresDateRange: true },
      { id: 'trial_balance', name: 'Trial Balance PDF', description: 'List of all accounts with their debit and credit balances' }
    ],
    filterOptions: [
      { id: 'date_range', name: 'Date Range', type: 'daterange' },
      { id: 'account_type', name: 'Account Type', type: 'select', options: [
        { value: 'assets', label: 'Assets' },
        { value: 'liabilities', label: 'Liabilities' },
        { value: 'equity', label: 'Equity' },
        { value: 'revenue', label: 'Revenue' },
        { value: 'expenses', label: 'Expenses' }
      ]}
    ]
  },
  {
    id: 'overview',
    name: 'Overview',
    icon: FileSpreadsheet,
    description: 'Comprehensive business reports',
    pdfTypes: [
      { id: 'all_in_one', name: 'All-in-One PDF', description: 'Complete business overview (Clients, Payments, Expenses, Tasks, Salaries, Events)' },
      { id: 'summary_report', name: 'High-level Summary Report PDF', description: 'Executive summary with charts & KPIs', requiresDateRange: true }
    ],
    filterOptions: [
      { id: 'date_range', name: 'Date Range', type: 'daterange' },
      { id: 'event_filter', name: 'Filter by Event', type: 'select' }
    ]
  }
];

interface CentralizedExportSystemProps {
  trigger?: React.ReactNode;
  currentModule?: string;
  data?: any;
}

export const CentralizedExportSystem: React.FC<CentralizedExportSystemProps> = ({
  trigger,
  currentModule,
  data
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>(currentModule || '');
  const [selectedPDFType, setSelectedPDFType] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { toast } = useToast();

  const currentModuleConfig = EXPORT_MODULES.find(m => m.id === selectedModule);
  const currentPDFType = currentModuleConfig?.pdfTypes.find(p => p.id === selectedPDFType);

  const handleFilterChange = (filterId: string, value: any) => {
    setFilters(prev => ({ ...prev, [filterId]: value }));
  };

  const handleGeneratePDF = async () => {
    if (!selectedModule || !selectedPDFType) {
      toast({
        title: "Selection Required",
        description: "Please select a module and PDF type.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Here we'll call the appropriate PDF generator based on module and type
      await generatePDF(selectedModule, selectedPDFType, filters, dateRange, searchQuery);
      
      toast({
        title: "PDF Generated Successfully",
        description: `${currentPDFType?.name} has been downloaded.`
      });
      
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error Generating PDF",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = async (module: string, pdfType: string, filters: any, dateRange: any, search: string) => {
    const { UniversalPDFGenerator } = await import('./UniversalPDFGenerator');
    const firmId = localStorage.getItem('selectedFirmId') || '';
    await UniversalPDFGenerator.generatePDF({ module, pdfType, filters, dateRange, searchQuery: search, firmId });
  };

  const getPreviewData = () => {
    if (!currentModuleConfig || !data) return null;
    
    // Apply filters and search to data
    let filteredData = data;
    
    if (searchQuery) {
      // Apply search filter based on module type
      filteredData = filteredData.filter((item: any) => {
        const searchFields = getSearchFields(selectedModule);
        return searchFields.some(field => 
          item[field]?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }
    
    return {
      count: filteredData.length,
      summary: getModuleSummary(selectedModule, filteredData)
    };
  };

  const getSearchFields = (module: string): string[] => {
    const searchFieldMap: Record<string, string[]> = {
      clients: ['name', 'phone', 'email'],
      quotations: ['title', 'venue'],
      events: ['title', 'venue'],
      tasks: ['title', 'description'],
      salary: ['full_name'],
      expenses: ['description', 'category'],
      finance: ['reference_number', 'notes'],
      overview: ['title', 'name']
    };
    return searchFieldMap[module] || [];
  };

  const getModuleSummary = (module: string, data: any[]): Record<string, string> => {
    // Generate summary based on module type
    switch (module) {
      case 'clients':
        return {
          'Total Clients': data.length.toString(),
          'Active Clients': data.filter(c => c.events?.length > 0).length.toString()
        };
      case 'quotations':
        const totalValue = data.reduce((sum, q) => sum + (q.amount || 0), 0);
        return {
          'Total Quotations': data.length.toString(),
          'Total Value': `₹${totalValue.toLocaleString()}`
        };
      case 'events':
        const totalAmount = data.reduce((sum, e) => sum + (e.total_amount || 0), 0);
        return {
          'Total Events': data.length.toString(),
          'Total Value': `₹${totalAmount.toLocaleString()}`
        };
      default:
        return { 'Total Records': data.length.toString() };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Centralized Export System
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Module Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Module</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EXPORT_MODULES.map((module) => {
                const Icon = module.icon;
                return (
                  <Card 
                    key={module.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedModule === module.id ? "ring-2 ring-primary" : ""
                    )}
                    onClick={() => {
                      setSelectedModule(module.id);
                      setSelectedPDFType('');
                      setFilters({});
                    }}
                  >
                    <CardContent className="p-4 text-center">
                      <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h3 className="font-medium text-sm">{module.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {module.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {selectedModule && (
            <>
              <Separator />
              
              {/* PDF Type Selection */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Select PDF Type</Label>
                <div className="grid gap-3">
                  {currentModuleConfig?.pdfTypes.map((pdfType) => (
                    <Card 
                      key={pdfType.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-sm",
                        selectedPDFType === pdfType.id ? "ring-2 ring-primary" : ""
                      )}
                      onClick={() => setSelectedPDFType(pdfType.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{pdfType.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {pdfType.description}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {pdfType.requiresDateRange && (
                              <Badge variant="secondary" className="text-xs">Date Range</Badge>
                            )}
                            {pdfType.requiresEntitySelection && (
                              <Badge variant="secondary" className="text-xs">Entity Select</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedPDFType && (
            <>
              <Separator />
              
              {/* Filters and Search */}
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters & Search
                </Label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={`Search ${currentModuleConfig?.name.toLowerCase()}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {/* Dynamic Filters */}
                  {currentModuleConfig?.filterOptions.map((filter) => (
                    <div key={filter.id} className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{filter.name}</Label>
                      {filter.type === 'select' && (
                        <Select 
                          value={filters[filter.id] || ''} 
                          onValueChange={(value) => handleFilterChange(filter.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${filter.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {filter.type === 'daterange' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateRange?.from ? (
                                dateRange.to ? (
                                  <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                  </>
                                ) : (
                                  format(dateRange.from, "LLL dd, y")
                                )
                              ) : (
                                <span>Pick a date range</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              initialFocus
                              mode="range"
                              defaultMonth={dateRange?.from}
                              selected={dateRange}
                              onSelect={setDateRange}
                              numberOfMonths={2}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ))}
                </div>

                {/* Date Range for PDFs that require it */}
                {currentPDFType?.requiresDateRange && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Date Range Required</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Preview */}
              {data && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Preview</Label>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{currentPDFType?.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {(() => {
                          const preview = getPreviewData();
                          return preview ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{preview.count} records</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {Object.entries(preview.summary).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="font-medium">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No data available for preview</p>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {/* Generate Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGeneratePDF}
                  disabled={isGenerating || (!currentPDFType?.requiresDateRange ? false : !dateRange)}
                  className="min-w-32"
                >
                  {isGenerating ? (
                    <>
                      <LoadingSpinner className="h-4 w-4 mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CentralizedExportSystem;