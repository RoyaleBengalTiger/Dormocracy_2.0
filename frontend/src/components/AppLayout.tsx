 import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
  import { Building2, LayoutDashboard, ListChecks, Crown, LogOut, Shield } from 'lucide-react';
 import { RoleBadge } from './RoleBadge';
 
 export function AppLayout() {
   const { user, logout } = useAuth();
   const location = useLocation();
   const navigate = useNavigate();
 
   const handleLogout = () => {
     logout();
     navigate('/login');
   };
 
   const isActive = (path: string) => location.pathname === path;
 
   return (
     <div className="flex min-h-screen">
       <aside className="w-64 border-r glass-card">
         <div className="sticky top-0 flex flex-col h-screen">
           <div className="p-6 border-b">
             <div className="flex items-center gap-3 mb-4">
               <Building2 className="h-8 w-8 text-primary" />
               <span className="text-xl font-bold">Bureau of Halls</span>
             </div>
             {user && (
               <div className="space-y-2">
                 <p className="font-medium">{user.username}</p>
                 <RoleBadge role={user.role} />
               </div>
             )}
           </div>
 
           <nav className="flex-1 p-4 space-y-2">
             <Link to="/app/dashboard">
               <Button
                 variant={isActive('/app/dashboard') ? 'secondary' : 'ghost'}
                 className="w-full justify-start"
               >
                 <LayoutDashboard className="mr-2 h-4 w-4" />
                 Dashboard
               </Button>
             </Link>
 
             <Link to="/app/tasks">
               <Button
                 variant={isActive('/app/tasks') ? 'secondary' : 'ghost'}
                 className="w-full justify-start"
               >
                 <ListChecks className="mr-2 h-4 w-4" />
                 Tasks
               </Button>
             </Link>
 
              {user?.role === 'MAYOR' && (
               <Link to="/app/mayor">
                 <Button
                   variant={isActive('/app/mayor') ? 'secondary' : 'ghost'}
                   className="w-full justify-start"
                 >
                   <Crown className="mr-2 h-4 w-4" />
                   Mayor Dashboard
                 </Button>
               </Link>
             )}

              {user?.role === 'ADMIN' && (
                <Link to="/app/admin/rooms">
                  <Button
                    variant={isActive('/app/admin/rooms') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Assign Mayors
                  </Button>
                </Link>
              )}
           </nav>
 
           <div className="p-4 border-t">
             <Button
               variant="ghost"
               className="w-full justify-start"
               onClick={handleLogout}
             >
               <LogOut className="mr-2 h-4 w-4" />
               Sign Out
             </Button>
           </div>
         </div>
       </aside>
 
       <main className="flex-1 overflow-y-auto">
         <Outlet />
       </main>
     </div>
   );
 }