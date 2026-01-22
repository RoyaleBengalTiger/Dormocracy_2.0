 import { useState } from 'react';
 import { useNavigate, Link } from 'react-router-dom';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import { motion } from 'framer-motion';
 import { authApi } from '@/api/auth';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 import { Building2 } from 'lucide-react';
 
 const loginSchema = z.object({
   email: z.string().email('Invalid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
 });
 
 type LoginFormData = z.infer<typeof loginSchema>;
 
 export default function Login() {
   const navigate = useNavigate();
   const { login } = useAuth();
   const { toast } = useToast();
   const [isLoading, setIsLoading] = useState(false);
 
   const {
     register,
     handleSubmit,
     formState: { errors },
   } = useForm<LoginFormData>({
     resolver: zodResolver(loginSchema),
   });
 
   const onSubmit = async (formData: LoginFormData) => {
     setIsLoading(true);
     try {
       // Backend returns only { accessToken }
       const response = await authApi.login({
         email: formData.email,
         password: formData.password,
       });
       
       // Store token and fetch user profile
       await login(response.accessToken);
       
       toast({
         title: 'Welcome back!',
         description: 'Successfully logged in',
       });
       navigate('/app/dashboard');
     } catch (error) {
       toast({
         title: 'Login failed',
         description: error instanceof Error ? error.message : 'Invalid credentials',
         variant: 'destructive',
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   return (
     <div className="flex min-h-screen">
       <motion.div
         initial={{ opacity: 0, x: -20 }}
         animate={{ opacity: 1, x: 0 }}
         className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-16"
       >
         <div className="mx-auto w-full max-w-md">
           <div className="mb-8 flex items-center gap-3">
             <Building2 className="h-10 w-10 text-primary" />
             <h1 className="text-3xl font-bold">Bureau of Halls</h1>
           </div>
 
           <h2 className="mb-2 text-2xl font-semibold">Welcome back</h2>
           <p className="mb-8 text-muted-foreground">Sign in to your citizen account</p>
 
           <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
             <div className="space-y-2">
               <Label htmlFor="email">Email</Label>
               <Input
                 id="email"
                 type="email"
                 placeholder="citizen@bureau.hall"
                 {...register('email')}
               />
               {errors.email && (
                 <p className="text-sm text-destructive">{errors.email.message}</p>
               )}
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="password">Password</Label>
               <Input
                 id="password"
                 type="password"
                 {...register('password')}
               />
               {errors.password && (
                 <p className="text-sm text-destructive">{errors.password.message}</p>
               )}
             </div>
 
             <Button type="submit" className="w-full" disabled={isLoading}>
               {isLoading ? 'Signing in...' : 'Sign In'}
             </Button>
           </form>
 
           <p className="mt-6 text-center text-sm text-muted-foreground">
             Don't have an account?{' '}
             <Link to="/signup" className="text-primary hover:underline">
               Sign up
             </Link>
           </p>
         </div>
       </motion.div>
 
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 0.2 }}
         className="hidden lg:flex lg:w-1/2 items-center justify-center glass-card m-4"
       >
         <div className="p-12 text-center">
           <h3 className="mb-4 text-3xl font-bold">Your Hall Awaits</h3>
           <p className="text-lg text-muted-foreground">
             Access your tasks, connect with roommates, and participate in hall governance.
           </p>
         </div>
       </motion.div>
     </div>
   );
 }