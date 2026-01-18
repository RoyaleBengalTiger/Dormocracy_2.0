 import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
 import { User } from '@/types';
 import { httpClient } from '@/lib/http';
 import { usersApi } from '@/api/users';
 import { authApi } from '@/api/auth';
 
 interface AuthContextType {
   user: User | null;
   isLoading: boolean;
   login: (accessToken: string) => Promise<void>;
   logout: () => void;
   refetchUser: () => Promise<void>;
 }
 
 const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
 export function AuthProvider({ children }: { children: ReactNode }) {
   const [user, setUser] = useState<User | null>(null);
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     // Check for existing token on mount
     const token = httpClient.getAccessToken();
     if (token) {
       fetchUser();
     } else {
       setIsLoading(false);
     }
   }, []);
 
   const fetchUser = async () => {
     try {
       const user = await usersApi.getMe();
       setUser(user);
     } catch (error) {
       console.error('Failed to fetch user:', error);
       httpClient.setAccessToken(null);
     } finally {
       setIsLoading(false);
     }
   };
 
   const login = async (accessToken: string) => {
     httpClient.setAccessToken(accessToken);
     // Fetch user profile after setting token
     await fetchUser();
   };
 
   const logout = () => {
     authApi.logout();
     setUser(null);
   };
 
   const refetchUser = async () => {
     await fetchUser();
   };
 
   return (
     <AuthContext.Provider value={{ user, isLoading, login, logout, refetchUser }}>
       {children}
     </AuthContext.Provider>
   );
 }
 
 export function useAuth() {
   const context = useContext(AuthContext);
   if (context === undefined) {
     throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
 }