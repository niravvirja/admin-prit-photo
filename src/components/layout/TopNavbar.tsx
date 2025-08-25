
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  UserIcon, 
  Logout04Icon, 
  Calendar01Icon,
  UserGroupIcon,
  ChartIcon,
  File01Icon,
  DollarCircleIcon,
  CheckListIcon,
  TableIcon,
  MoneyBag02Icon,
  QrCode01Icon,
  Calculator01Icon
} from 'hugeicons-react';

import FirmSelector from '@/components/layout/FirmSelector';
import MobileFloatingDock from '@/components/layout/MobileFloatingDock';
import { useFirmLogo } from '@/hooks/useFirmLogo';
import { useState } from 'react';

const adminNavigationItems = [
  { name: 'Clients', href: '/clients', icon: UserGroupIcon, roles: ['Admin'] },
  { name: 'Quotations', href: '/quotations', icon: File01Icon, roles: ['Admin'] },
  { name: 'Events', href: '/events', icon: Calendar01Icon, roles: ['Admin'] },
  { name: 'Tasks', href: '/tasks', icon: CheckListIcon, roles: ['Admin'] },
  { name: 'Freelancers', href: '/freelancers', icon: UserIcon, roles: ['Admin'] },
  { name: 'Salary', href: '/salary', icon: MoneyBag02Icon, roles: ['Admin'] },
  { name: 'Expenses', href: '/expenses', icon: DollarCircleIcon, roles: ['Admin'] },
  { name: 'Finance', href: '/finance', icon: ChartIcon, roles: ['Admin'] },
  { name: 'Overview', href: '/overview', icon: TableIcon, roles: ['Admin'] },
];

const staffNavigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartIcon, roles: ['Photographer', 'Cinematographer', 'Editor'] },
  { name: 'Tasks', href: '/tasks', icon: CheckListIcon, roles: ['Photographer', 'Cinematographer', 'Editor'] },
];

interface TopNavbarProps {
  children: React.ReactNode;
}

const TopNavbar = ({ children }: TopNavbarProps) => {
  const { user, profile, signOut } = useAuth();
  const { logoUrl, isLoading } = useFirmLogo();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const navigation = profile?.role === 'Admin' 
    ? adminNavigationItems.filter(item => item.roles.includes(profile.role))
    : staffNavigationItems.filter(item => profile && item.roles.includes(profile.role));

  const handleSignOut = async () => {
    if (signingOut) return;
    
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      // Sign out error handled
      setSigningOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="w-full flex h-16 items-center px-4">
          {/* Left Section - Logo */}
          <div className="flex items-center pl-2">
          <div 
            className="cursor-pointer relative" 
            onClick={() => navigate(profile?.role === 'Admin' ? '/events' : '/dashboard')}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img 
              src={logoUrl}
              alt="Firm Logo"
              className="h-10 sm:h-12 w-auto object-contain transition-opacity duration-200 hover:opacity-80"
              onError={(e) => {
                // If current firm logo fails, fallback to default
                if (e.currentTarget.src !== '/prit-logo.png') {
                  e.currentTarget.src = '/prit-logo.png';
                }
              }}
              // Prevent layout shift during loading
              style={{ minWidth: '40px', minHeight: '40px' }}
            />
          </div>
          </div>

          {/* Center Section - Navigation */}
          <div className="flex-1 flex justify-center">
            {profile?.role === 'Admin' ? (
              <nav className="hidden lg:flex items-center bg-muted/30 rounded-full p-1 space-x-0.5 border">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Button
                      key={item.name}
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(item.href)}
                      className={`relative h-9 px-3 rounded-full font-medium ${
                        active 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      <span className="text-sm">{item.name}</span>
                    </Button>
                  );
                })}
              </nav>
            ) : (
              <nav className="hidden lg:flex items-center bg-muted/30 rounded-full p-1 border">
                <div className="flex w-full">
                  {navigation.map((item, index) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const isFirst = index === 0;
                    const isLast = index === navigation.length - 1;
                    
                    return (
                      <Button
                        key={item.name}
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(item.href)}
                        className={`relative h-9 px-6 font-medium flex-1 ${
                          isFirst ? 'rounded-l-full' : isLast ? 'rounded-r-full' : ''
                        } ${
                          active 
                            ? 'bg-primary text-primary-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-1.5" />
                        <span className="text-sm">{item.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </nav>
            )}
          </div>

          {/* Right Section - WhatsApp, Firm Selector, Theme Toggle, User Avatar */}
          <div className="flex items-center space-x-2 pr-2">
            {profile?.role === 'Admin' && (
              <>
                {/* WhatsApp Integration */}
                <div className="bg-muted/30 rounded-full p-1 border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/whatsapp')}
                    className="h-8 w-8 rounded-full p-0 hover:bg-green-500/10"
                    title="WhatsApp Integration"
                  >
                    <QrCode01Icon className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </div>
                
                {/* Accounts */}
                <div className="bg-muted/30 rounded-full p-1 border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/accounts')}
                    className="h-8 w-8 rounded-full p-0 hover:bg-blue-500/10"
                    title="Accounts & Reports"
                  >
                    <Calculator01Icon className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </div>
                
                {/* Firm Selector */}
                <div className="bg-muted/30 rounded-full p-1 border">
                  <FirmSelector />
                </div>
              </>
            )}

            {/* User Avatar */}
            <div className="bg-muted/30 rounded-full p-1 border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-9 w-9 rounded-full p-0" 
                    disabled={signingOut}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                        {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2 bg-card border shadow-lg" align="end" forceMount>
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {profile?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {profile?.role}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="py-2">
                  <DropdownMenuItem onClick={() => navigate('/profile')} disabled={signingOut} className="cursor-pointer rounded-lg">
                    <UserIcon className="mr-3 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="cursor-pointer text-destructive focus:text-destructive rounded-lg">
                    <Logout04Icon className="mr-3 h-4 w-4" />
                    <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
                  </DropdownMenuItem>
                </div>
               </DropdownMenuContent>
               </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-3 pb-20 lg:pb-3 px-3">
        {children}
      </main>

      <MobileFloatingDock />
    </div>
  );
};

export default TopNavbar;
