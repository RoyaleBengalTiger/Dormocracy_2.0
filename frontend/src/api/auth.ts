 import { httpClient } from '@/lib/http';
 import { LoginDto, SignupDto, AuthResponse } from '@/types';
 
 const AUTH_LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH || '/auth/login';
 const AUTH_REGISTER_PATH = import.meta.env.VITE_AUTH_REGISTER_PATH || '/auth/register';
 
 export const authApi = {
   // Returns only { accessToken: string }
   login: (data: LoginDto) => httpClient.post<AuthResponse>(AUTH_LOGIN_PATH, data),
   
   // Returns only { accessToken: string }
   signup: (data: SignupDto) => httpClient.post<AuthResponse>(AUTH_REGISTER_PATH, data),
   
   logout: () => {
     httpClient.setAccessToken(null);
   },
 };