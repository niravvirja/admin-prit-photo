
import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TopNavbar from '@/components/layout/TopNavbar';
import ClientTableManagement from '@/components/clients/ClientTableManagement';
import FirmRequiredWrapper from '@/components/layout/FirmRequiredWrapper';
import { PageTableSkeleton } from '@/components/ui/skeleton';
const Clients = () => {
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    // Only redirect non-admin users AFTER profile has loaded
    if (!loading && user && profile && profile.role !== 'Admin') {
      navigate('/tasks');
    }
  }, [user, loading, profile, navigate]);

  if (loading) {
    return (
      <TopNavbar>
        <PageTableSkeleton />
      </TopNavbar>
    );
  }

  return (
    <TopNavbar>
      <FirmRequiredWrapper 
        title="No Firm Selected"
        description="Please select a firm from the dropdown in the navbar to manage clients, or create a new firm to get started."
      >
        <ClientTableManagement />
      </FirmRequiredWrapper>
    </TopNavbar>
  );
};

export default Clients;
