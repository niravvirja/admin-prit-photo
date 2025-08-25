import React from 'react';
import TopNavbar from '@/components/layout/TopNavbar';
import FirmRequiredWrapper from '@/components/layout/FirmRequiredWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserIcon, Call02Icon, AiMailIcon, Calendar01Icon, Edit01Icon } from 'hugeicons-react';
import FirmManagement from '@/components/profile/FirmManagement';
import ProfileEditor from '@/components/profile/ProfileEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '@/types/studio';
import { displayRole, getRoleOptions } from '@/lib/role-utils';

const Profile = () => {
  const { profile, user } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Role color mapping using correct enum values
  const getRoleColor = (role?: string | null): string => {
    const normalizedRole = displayRole(role);
    const roleColors: Record<UserRole, string> = {
      'Admin': 'bg-red-100 text-red-800',
      'Photographer': 'bg-blue-100 text-blue-800',
      'Cinematographer': 'bg-purple-100 text-purple-800',
      'Editor': 'bg-cyan-100 text-cyan-800',
      'Drone Pilot': 'bg-teal-100 text-teal-800',
      'Other': 'bg-orange-100 text-orange-800'
    };
    return roleColors[normalizedRole];
  };

  return (
    <TopNavbar>
      <FirmRequiredWrapper>
        <div className="space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Profile</h1>
          
          <Tabs defaultValue="view" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="view">View Profile</TabsTrigger>
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Edit01Icon className="h-4 w-4" />
                Edit Profile
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="view" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                          {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-semibold">{profile?.full_name || 'Unknown User'}</h3>
                        <Badge className={getRoleColor(profile?.role || 'Other')} variant="secondary">
                          {displayRole(profile?.role || 'Other')}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <AiMailIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{user?.email || '~'}</span>
                      </div>
                      
                      {profile?.mobile_number && (
                        <div className="flex items-center space-x-3">
                          <Call02Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{profile.mobile_number}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-3">
                        <Calendar01Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Joined {new Date(profile?.created_at || '').toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Firm Management */}
                <FirmManagement />
              </div>
            </TabsContent>
            
            <TabsContent value="edit" className="mt-6">
              <div className="max-w-2xl mx-auto">
                <ProfileEditor />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </FirmRequiredWrapper>
    </TopNavbar>
  );
};

export default Profile;