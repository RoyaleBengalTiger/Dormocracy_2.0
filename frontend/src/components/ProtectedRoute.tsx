 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 
 interface ProtectedRouteProps {
   children: React.ReactNode;
  requiredRole?: string;
 }
 
 export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
   const { user, isLoading } = useAuth();
 
   if (isLoading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
       </div>
     );
   }
 
   if (!user) {
     return <Navigate to="/login" replace />;
   }
 
   if (requiredRole && user.role !== requiredRole) {
     return <Navigate to="/app/dashboard" replace />;
   }
 
   return <>{children}</>;
 }