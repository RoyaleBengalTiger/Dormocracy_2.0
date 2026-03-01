import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Crown,
  LogOut,
  Scale,
  Shield,
  MessagesSquare,
  Handshake,
  PanelLeftClose,
  PanelLeftOpen,
  Vote,
} from 'lucide-react';
import { RoleBadge } from './RoleBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  /** Renders a nav link — shows tooltip with the label when collapsed. */
  const navItem = (
    to: string,
    icon: React.ReactNode,
    label: string,
    active: boolean,
  ) => (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link to={to}>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
          >
            {icon}
            {!collapsed && <span>{label}</span>}
          </Button>
        </Link>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <div className="flex min-h-screen">
      <aside
        className={`border-r glass-card transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
          }`}
      >
        <div className="sticky top-0 flex flex-col h-screen">
          {/* Header */}
          <div className={`border-b ${collapsed ? 'p-2' : 'p-6'}`}>
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 mb-4'}`}>
              <Building2 className="h-8 w-8 shrink-0 text-primary" />
              {!collapsed && <span className="text-xl font-bold">Bureau of Halls</span>}
            </div>
            {!collapsed && user && (
              <div className="space-y-2 mt-4">
                <p className="font-medium truncate">{user.username}</p>
                <RoleBadge
                  role={user.role}
                  isPrimeMinister={user.isPrimeMinister}
                  isForeignMinister={user.isForeignMinister}
                  isMayor={user.isMayor}
                  isFinanceMinister={user.isFinanceMinister}
                />
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} px-2 py-2`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 space-y-2 ${collapsed ? 'px-1' : 'px-4'}`}>
            {navItem(
              '/app/dashboard',
              <LayoutDashboard className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Dashboard',
              isActive('/app/dashboard'),
            )}
            {navItem(
              '/app/tasks',
              <ListChecks className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Tasks',
              isActive('/app/tasks'),
            )}
            {navItem(
              '/app/violations',
              <AlertTriangle className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Violations',
              isActive('/app/violations'),
            )}
            {navItem(
              '/chat/room',
              <MessagesSquare className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Room Chat',
              isActive('/chat/room') || isActive('/chat/debug'),
            )}
            {navItem(
              '/app/treaties',
              <Handshake className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Treaties',
              location.pathname.startsWith('/app/treaties'),
            )}
            {navItem(
              '/app/elections',
              <Vote className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
              'Elections',
              isActive('/app/elections'),
            )}
            {(user?.isMayor || user?.role === 'PM' || user?.role === 'MINISTER' || user?.role === 'MAYOR' || user?.role === 'ADMIN') &&
              navItem(
                '/app/senate',
                <Crown className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
                'Senate Chat',
                isActive('/app/senate'),
              )}
            {user?.role === 'MAYOR' &&
              navItem(
                '/app/mayor',
                <Crown className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
                'Mayor Dashboard',
                isActive('/app/mayor'),
              )}
            {user?.isPrimeMinister &&
              navItem(
                '/app/pm/inbox',
                <Scale className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
                'PM Inbox',
                location.pathname.startsWith('/app/pm'),
              )}
            {(user?.isFinanceMinister || user?.role === 'ADMIN') &&
              navItem(
                '/app/finance',
                <Banknote className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />,
                'Finance',
                isActive('/app/finance'),
              )}

          </nav>

          {/* Footer */}
          <div className={`border-t ${collapsed ? 'p-1' : 'p-4'}`}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
                  onClick={handleLogout}
                >
                  <LogOut className={`h-4 w-4 shrink-0 ${collapsed ? '' : 'mr-2'}`} />
                  {!collapsed && <span>Sign Out</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" sideOffset={8}>
                  Sign Out
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}