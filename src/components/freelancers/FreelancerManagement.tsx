import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FreelancerFormDialog from './FreelancerFormDialog';
import FreelancerTableView from './FreelancerTableView';
import { useFreelancers } from './hooks/useFreelancers';
import { Freelancer, FreelancerFormData } from '@/types/freelancer';
import { PageTableSkeleton } from '@/components/ui/skeleton';
import StatsGrid from '@/components/ui/stats-grid';
import { User, Mail, Phone, Clock } from 'lucide-react';
import { EnhancedConfirmationDialog } from '@/components/ui/enhanced-confirmation-dialog';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';

const FreelancerManagement: React.FC = () => {
  const { freelancers, loading, createFreelancer, updateFreelancer, deleteFreelancer, confirmDialog, setConfirmDialog } = useFreelancers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<Freelancer | null>(null);

  // Search, Sort & Filter
  const {
    searchValue,
    setSearchValue,
    currentSort,
    sortDirection,
    activeFilters,
    filteredAndSortedData: filteredFreelancers,
    handleSortChange,
    handleSortDirectionToggle,
    handleFilterChange
  } = useSearchSortFilter({
    data: freelancers,
    searchFields: ['full_name', 'role', 'phone', 'email'],
    defaultSort: 'full_name'
  });

  const handleAddNew = () => {
    setSelectedFreelancer(null);
    setDialogOpen(true);
  };

  const handleEdit = (freelancer: Freelancer) => {
    setSelectedFreelancer(freelancer);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: FreelancerFormData) => {
    if (selectedFreelancer) {
      await updateFreelancer(selectedFreelancer.id, data);
    } else {
      await createFreelancer(data);
    }
    setDialogOpen(false);
    setSelectedFreelancer(null);
  };

  const handleDelete = async (id: string) => {
    await deleteFreelancer(id);
  };

  // Use freelancers with filter processing
  const processedFreelancers = useMemo(() => {
    let filtered = [...filteredFreelancers];

    // Apply custom filters for availability, location, rate range etc
    // (Can be extended based on your freelancer data structure)

    return filtered;
  }, [filteredFreelancers, activeFilters]);

  if (loading) {
    return <PageTableSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Freelancers</h1>
        <Button onClick={handleAddNew} className="rounded-full p-3">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Freelancer Statistics */}
      <StatsGrid stats={[
        {
          title: "Total Freelancers",
          value: freelancers.length,
          icon: <User className="h-4 w-4" />,
          colorClass: "bg-primary/20 text-primary"
        },
        {
          title: "With Email",
          value: freelancers.filter(f => f.email).length,
          icon: <Mail className="h-4 w-4" />,
          colorClass: "bg-primary/15 text-primary"
        },
        {
          title: "With Notes",
          value: freelancers.filter(f => f.notes).length,
          icon: <Phone className="h-4 w-4" />,
          colorClass: "bg-primary/25 text-primary"
        },
        {
          title: "Recent",
          value: freelancers.filter(f => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(f.created_at) > weekAgo;
          }).length,
          icon: <Clock className="h-4 w-4" />,
          colorClass: "bg-primary/10 text-primary"
        }
      ]} />

      {/* Search, Sort & Filter */}
      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search freelancers by name, role, contact..."
        sortOptions={[
          { key: 'full_name', label: 'Name' },
          { key: 'role', label: 'Role' },
          { key: 'rate', label: 'Rate' },
          { key: 'created_at', label: 'Date Added' }
        ]}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        filterOptions={[
          {
            key: 'role',
            label: 'Skill Type',
            type: 'checkbox',
            options: [
              { value: 'Photographer', label: 'Photographer' },
              { value: 'Cinematographer', label: 'Cinematographer' },
              { value: 'Editor', label: 'Editor' },
              { value: 'Drone Pilot', label: 'Drone Pilot' },
              { value: 'Other', label: 'Other' }
            ]
          },
          {
            key: 'has_email',
            label: 'Contact Info',
            type: 'select',
            options: [
              { value: 'with_email', label: 'With Email' },
              { value: 'without_email', label: 'Without Email' }
            ]
          },
          {
            key: 'created_at',
            label: 'Date Added',
            type: 'date'
          }
        ]}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />

      {/* Freelancers List */}
      <FreelancerTableView
        freelancers={processedFreelancers}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FreelancerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        freelancer={selectedFreelancer}
        onSubmit={handleSubmit}
      />
      
      <EnhancedConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.variant === 'destructive' ? 'Delete' : 'OK'}
        requireTextConfirmation={confirmDialog.requireTextConfirmation}
        confirmationKeyword={confirmDialog.confirmationKeyword}
        loading={confirmDialog.loading}
      />
    </div>
  );
};

export default FreelancerManagement;