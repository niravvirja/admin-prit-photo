
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FilterIcon, Search01Icon, ArrowUp01Icon, ArrowDown01Icon } from 'hugeicons-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export interface SortOption {
  key: string;
  label: string;
}

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'checkbox' | 'date' | 'range';
  options?: { value: string; label: string }[];
  value?: any;
}

export interface SearchSortFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortOptions: SortOption[];
  currentSort: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortKey: string) => void;
  onSortDirectionToggle?: () => void;
  filterOptions: FilterOption[];
  activeFilters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  searchPlaceholder?: string;
  className?: string;
}

export const SearchSortFilter: React.FC<SearchSortFilterProps> = ({
  searchValue,
  onSearchChange,
  sortOptions,
  currentSort,
  sortDirection,
  onSortChange,
  onSortDirectionToggle = () => {},
  filterOptions,
  activeFilters,
  onFilterChange,
  searchPlaceholder = "Search...",
  className
}) => {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState(activeFilters);
  const isMobile = useIsMobile();

  const handleSortChange = (value: string) => {
    onSortChange(value);
  };

  const handleFilterApply = () => {
    onFilterChange(tempFilters);
    setFilterDialogOpen(false);
  };

  const handleFilterReset = () => {
    const resetFilters = filterOptions.reduce((acc, filter) => {
      acc[filter.key] = filter.type === 'checkbox' ? [] : '';
      return acc;
    }, {} as Record<string, any>);
    setTempFilters(resetFilters);
    onFilterChange(resetFilters);
    setFilterDialogOpen(false);
  };

  const handleQuickReset = () => {
    const resetFilters = filterOptions.reduce((acc, filter) => {
      acc[filter.key] = filter.type === 'checkbox' ? [] : '';
      return acc;
    }, {} as Record<string, any>);
    setTempFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== '' && value !== null && value !== undefined;
    }).length;
  };

  const currentSortOption = sortOptions.find(option => option.key === currentSort);

  if (isMobile) {
    return (
      <>
        <div className={cn("flex items-center gap-2 p-4 bg-card rounded-lg border", className)}>
          <div className="flex-1 relative">
            <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setFilterDialogOpen(true)}
              className="rounded-full relative h-10 w-10"
            >
              <FilterIcon className="h-4 w-4" />
              {getActiveFilterCount() > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs rounded-full bg-primary flex items-center justify-center">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
            {getActiveFilterCount() > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleQuickReset}
                className="rounded-full h-10 w-10"
                title="Clear all filters"
              >
                <div className="h-4 w-4 flex items-center justify-center">✕</div>
              </Button>
            )}
          </div>
        </div>

        {/* Filter Dialog for Mobile */}
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[500px] md:max-w-[600px] max-h-[70vh] md:max-h-[90vh] overflow-y-auto mx-auto z-[100] bg-background border">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {filterOptions.map((filter) => (
                <div key={filter.key} className="space-y-2">
                  <Label className="text-sm font-medium">{filter.label}</Label>
                  
                   {filter.type === 'select' && (
                    <Select
                      value={tempFilters[filter.key] || '__all__'}
                      onValueChange={(value) => setTempFilters(prev => ({ ...prev, [filter.key]: value === '__all__' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${filter.label}`} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-[110]">
                        <SelectItem value="__all__">All</SelectItem>
                     {filter.options?.map((option) => (
                        <SelectItem key={`mobile-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  )}

                 {filter.type === 'checkbox' && (
                   <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filter.options?.map((option) => (
                       <div key={`mobile-checkbox-${option.value}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${filter.key}-${option.value}`}
                            checked={(tempFilters[filter.key] || []).includes(option.value)}
                            onCheckedChange={(checked) => {
                              const currentValues = tempFilters[filter.key] || [];
                              const newValues = checked
                                ? [...currentValues, option.value]
                                : currentValues.filter((v: string) => v !== option.value);
                              setTempFilters(prev => ({ ...prev, [filter.key]: newValues }));
                            }}
                          />
                          <Label htmlFor={`${filter.key}-${option.value}`} className="text-sm">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {filter.type === 'date' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !tempFilters[filter.key] && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {tempFilters[filter.key] ? (
                            format(new Date(tempFilters[filter.key]), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover z-[110]" align="start">
                        <Calendar
                          mode="single"
                          selected={tempFilters[filter.key] ? new Date(tempFilters[filter.key]) : undefined}
                         onSelect={(date) => setTempFilters(prev => ({ 
                           ...prev, 
                           [filter.key]: date ? format(date, 'yyyy-MM-dd') : '' 
                         }))}
                         initialFocus
                         className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleFilterReset} className="flex-1">
                Reset
              </Button>
              <Button onClick={handleFilterApply} className="flex-1">
                Apply Filters
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className={cn("flex items-center justify-between gap-4 p-4 bg-card rounded-lg border", className)}>
        {/* Search - Left */}
        <div className="flex-1 relative max-w-md">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort - Center */}
        <div className="flex items-center gap-2">
          <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {sortOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={onSortDirectionToggle}
            className="rounded-full"
            title={`Currently sorting ${sortDirection === 'asc' ? 'A-Z' : 'Z-A'} - Click to ${sortDirection === 'asc' ? 'reverse' : 'reverse'}`}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp01Icon className="h-4 w-4" />
            ) : (
              <ArrowDown01Icon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Filters - Right */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setFilterDialogOpen(true)}
            className="relative"
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 text-xs rounded-full bg-primary flex items-center justify-center">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
          {getActiveFilterCount() > 0 && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleQuickReset}
              className="rounded-full"
              title="Clear all filters"
            >
              <div className="h-4 w-4 flex items-center justify-center">✕</div>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] md:max-w-[600px] max-h-[70vh] md:max-h-[90vh] overflow-y-auto mx-auto z-[100] bg-background border">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {filterOptions.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <Label className="text-sm font-medium">{filter.label}</Label>
                
                 {filter.type === 'select' && (
                  <Select
                    value={tempFilters[filter.key] || '__all__'}
                    onValueChange={(value) => setTempFilters(prev => ({ ...prev, [filter.key]: value === '__all__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-[110]">
                      <SelectItem value="__all__">All</SelectItem>
                      {filter.options?.map((option) => (
                        <SelectItem key={`desktop-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

               {filter.type === 'checkbox' && (
                 <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filter.options?.map((option) => (
                       <div key={`desktop-checkbox-${option.value}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${filter.key}-${option.value}`}
                          checked={(tempFilters[filter.key] || []).includes(option.value)}
                          onCheckedChange={(checked) => {
                            const currentValues = tempFilters[filter.key] || [];
                            const newValues = checked
                              ? [...currentValues, option.value]
                              : currentValues.filter((v: string) => v !== option.value);
                            setTempFilters(prev => ({ ...prev, [filter.key]: newValues }));
                          }}
                        />
                        <Label htmlFor={`${filter.key}-${option.value}`} className="text-sm">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {filter.type === 'date' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !tempFilters[filter.key] && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tempFilters[filter.key] ? (
                          format(new Date(tempFilters[filter.key]), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover z-[110]" align="start">
                      <Calendar
                        mode="single"
                        selected={tempFilters[filter.key] ? new Date(tempFilters[filter.key]) : undefined}
                       onSelect={(date) => setTempFilters(prev => ({ 
                         ...prev, 
                         [filter.key]: date ? format(date, 'yyyy-MM-dd') : '' 
                       }))}
                       initialFocus
                       className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleFilterReset} className="flex-1">
              Reset
            </Button>
            <Button onClick={handleFilterApply} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
