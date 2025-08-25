
import { useState, useMemo } from 'react';

export interface UseSearchSortFilterProps<T> {
  data: T[];
  searchFields: (keyof T)[];
  defaultSort: string;
  defaultSortDirection?: 'asc' | 'desc';
}

export function useSearchSortFilter<T>({
  data,
  searchFields,
  defaultSort,
  defaultSortDirection = 'desc'
}: UseSearchSortFilterProps<T>) {
  const [searchValue, setSearchValue] = useState('');
  const [currentSort, setCurrentSort] = useState(defaultSort);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply search
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      
      if (Array.isArray(value) && value.length === 0) return;

      filtered = filtered.filter(item => {
        const itemValue = item[key as keyof T];
        
        // Handle event-specific filters with proper enum matching
        if (key === 'event_type') {
          // Handle both UI format (spaces) and database format (hyphens)
          const eventTypeMap: Record<string, string> = {
            // UI format to database format mapping
            'ring ceremony': 'Ring-Ceremony',
            'pre wedding': 'Pre-Wedding', 
            'wedding': 'Wedding',
            'maternity photography': 'Maternity Photography',
            'others': 'Others',
            // Database format variations
            'ring-ceremony': 'Ring-Ceremony',
            'ring_ceremony': 'Ring-Ceremony',
            'pre-wedding': 'Pre-Wedding',
            'pre_wedding': 'Pre-Wedding',
            'maternity-photography': 'Maternity Photography',
            'maternity_photography': 'Maternity Photography'
          };
          
          // Handle multiple event type selections
          if (Array.isArray(value)) {
            const selectedTypes = value.map((v: any) => {
              const mappedValue = eventTypeMap[String(v).toLowerCase()] || v;
              return mappedValue;
            });
            return selectedTypes.includes(String(itemValue));
          }
          
          const mappedValue = eventTypeMap[String(value).toLowerCase()] || value;
          return String(itemValue) === mappedValue;
        }
        
        if (key === 'role') {
          // Case-insensitive role filtering supporting both single and multi-select values
          const itemRole = String(itemValue ?? '').toLowerCase();
          if (Array.isArray(value)) {
            const selectedRoles = value.map((v: any) => String(v ?? '').toLowerCase());
            return selectedRoles.includes(itemRole);
          }
          return itemRole === String(value ?? '').toLowerCase();
        }
        
        // Skip complex filters that are handled by component-specific logic
        if (['payment_status', 'status', 'amount_range', 'client_id', 'staff_assignment_status', 'date_range', 'mix_mode'].includes(key)) {
          return true;
        }
        
        // Handle mix mode filtering - apply to both staff and freelancer data
        if (key === 'mix_mode' && value === 'both') {
          return true; // Show all items in mix mode
        }
        
        // Custom filter logic for special salary filters
        if (key === 'payment_status' && (item as any).total_earnings !== undefined) {
          const totalEarnings = (item as any).total_earnings || 0;
          const paidAmount = (item as any).paid_amount || 0;
          const pendingAmount = totalEarnings - paidAmount;
          
          switch (value) {
            case 'fully_paid':
              return totalEarnings > 0 && pendingAmount <= 0;
            case 'partial_paid':
              return totalEarnings > 0 && paidAmount > 0 && pendingAmount > 0;
            case 'pending_payment':
              return totalEarnings > 0 && paidAmount === 0;
            case 'overpaid':
              return paidAmount > totalEarnings;
            case 'no_earnings':
              return totalEarnings === 0;
            default:
              return true;
          }
        }
        
        if (key === 'earning_range') {
          const totalEarnings = (item as any).total_earnings || 0;
          
          switch (value) {
            case 'under_10k':
            case 'under_5k':
              const threshold = value === 'under_10k' ? 10000 : 5000;
              return totalEarnings < threshold;
            case '10k_50k':
            case '5k_25k':
              const [min, max] = value === '10k_50k' ? [10000, 50000] : [5000, 25000];
              return totalEarnings >= min && totalEarnings <= max;
            case '50k_100k':
            case '25k_75k':
              const [min2, max2] = value === '50k_100k' ? [50000, 100000] : [25000, 75000];
              return totalEarnings >= min2 && totalEarnings <= max2;
            case 'above_100k':
            case 'above_75k':
              const thresholdHigh = value === 'above_100k' ? 100000 : 75000;
              return totalEarnings > thresholdHigh;
            default:
              return true;
          }
        }
        
        if (key === 'assignment_count') {
          const assignments = (item as any).total_assignments || 0;
          
          switch (value) {
            case 'no_assignments':
              return assignments === 0;
            case '1_5':
            case '1_3':
              const max = value === '1_5' ? 5 : 3;
              return assignments >= 1 && assignments <= max;
            case '6_15':
            case '4_10':
              const [minA, maxA] = value === '6_15' ? [6, 15] : [4, 10];
              return assignments >= minA && assignments <= maxA;
            case 'above_15':
            case 'above_10':
              const thresholdA = value === 'above_15' ? 15 : 10;
              return assignments > thresholdA;
            default:
              return true;
          }
        }
        
        if (key === 'task_completion') {
          const totalTasks = (item as any).total_tasks || 0;
          const completedTasks = (item as any).completed_tasks || 0;
          
          switch (value) {
            case 'all_completed':
              return totalTasks > 0 && totalTasks === completedTasks;
            case 'pending_tasks':
              return totalTasks > 0 && completedTasks < totalTasks;
            case 'no_tasks':
              return totalTasks === 0;
            default:
              return true;
          }
        }

        if (Array.isArray(value)) {
          return value.includes(String(itemValue));
        }
        
        // Date comparison
        const isDateFilter = key.includes('date') || 
          (itemValue instanceof Date || (typeof itemValue === 'string' && !isNaN(Date.parse(String(itemValue))))) &&
          (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(String(value)))));
          
        if (isDateFilter) {
          const itemDate = new Date(String(itemValue));
          const filterDate = new Date(value);
          if (!isNaN(itemDate.getTime()) && !isNaN(filterDate.getTime())) {
            return itemDate.toDateString() === filterDate.toDateString();
          }
        }
        
        // String/role matching
        return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
      });
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[currentSort as keyof T];
      const bValue = b[currentSort as keyof T];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      // Date comparison - handle null dates properly
      if (currentSort.includes('date') || aValue instanceof Date || bValue instanceof Date) {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        
        // Handle invalid dates - put them at the end
        const aIsValid = !isNaN(aDate.getTime());
        const bIsValid = !isNaN(bDate.getTime());
        
        if (!aIsValid && !bIsValid) return 0;
        if (!aIsValid) return sortDirection === 'asc' ? 1 : -1;
        if (!bIsValid) return sortDirection === 'asc' ? -1 : 1;
        
        const result = aDate.getTime() - bDate.getTime();
        return sortDirection === 'asc' ? result : -result;
      }
      
      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return sortDirection === 'asc' ? result : -result;
      }
      
      // String comparison
      const result = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  }, [data, searchValue, searchFields, currentSort, sortDirection, activeFilters]);

  const handleSortChange = (sortKey: string) => {
    setCurrentSort(sortKey);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleFilterChange = (filters: Record<string, any>) => {
    setActiveFilters(filters);
  };

  return {
    searchValue,
    setSearchValue,
    currentSort,
    sortDirection,
    activeFilters,
    filteredAndSortedData,
    handleSortChange,
    handleSortDirectionToggle,
    handleFilterChange
  };
}
