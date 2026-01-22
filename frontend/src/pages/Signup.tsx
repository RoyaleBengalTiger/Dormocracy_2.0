 import { useState, useEffect } from 'react';
 import { useNavigate, Link } from 'react-router-dom';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import { motion } from 'framer-motion';
 import { authApi } from '@/api/auth';
 import { departmentsApi } from '@/api/departments';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useToast } from '@/hooks/use-toast';
 import { Building2 } from 'lucide-react';
 import { Department } from '@/types';
 
 const signupSchema = z.object({
   username: z.string().min(3, 'Username must be at least 3 characters'),
   email: z.string().email('Invalid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
   departmentName: z.string().min(1, 'Please select a department'),
   roomNumber: z.string().min(1, 'Please enter a room number'),
 });
 
 type SignupFormData = z.infer<typeof signupSchema>;
 
 export default function Signup() {
   const navigate = useNavigate();
   const { login } = useAuth();
   const { toast } = useToast();
   const [isLoading, setIsLoading] = useState(false);
   const [departments, setDepartments] = useState<Department[]>([]);
 
   const {
     register,
     handleSubmit,
     setValue,
     formState: { errors },
   } = useForm<SignupFormData>({
     resolver: zodResolver(signupSchema),
   });
 
   useEffect(() => {
     loadDepartments();
   }, []);
 
   const loadDepartments = async () => {
     try {
       const data = await departmentsApi.getDepartments();
       setDepartments(data);
     } catch (error) {
       toast({
         title: 'Failed to load departments',
         description: 'Please refresh the page',
         variant: 'destructive',
       });
     }
   };
 
   const onSubmit = async (formData: SignupFormData) => {
     setIsLoading(true);
     try {
       // Backend expects departmentName and roomNumber (string)
       const response = await authApi.signup({
         username: formData.username,
         email: formData.email,
         password: formData.password,
         departmentName: formData.departmentName,
         roomNumber: formData.roomNumber,
       });
       
       // Store token and fetch user profile
       await login(response.accessToken);
       
       toast({
         title: 'Welcome to Bureau of Halls!',
         description: 'Account created successfully',
       });
       navigate('/app/dashboard');
     } catch (error) {
       toast({
         title: 'Signup failed',
         description: error instanceof Error ? error.message : 'Could not create account',
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
 
           <h2 className="mb-2 text-2xl font-semibold">Join your hall</h2>
           <p className="mb-8 text-muted-foreground">Create your citizen account</p>
 
           <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
             <div className="space-y-2">
               <Label htmlFor="username">Username</Label>
               <Input
                 id="username"
                 placeholder="citizen_name"
                 {...register('username')}
               />
               {errors.username && (
                 <p className="text-sm text-destructive">{errors.username.message}</p>
               )}
             </div>
 
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
 
             <div className="space-y-2">
               <Label htmlFor="department">Department</Label>
               <Select onValueChange={(value) => setValue('departmentName', value)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select your department" />
                 </SelectTrigger>
                 <SelectContent>
                   {departments.map((dept) => (
                     <SelectItem key={dept.id} value={dept.name}>
                       {dept.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               {errors.departmentName && (
                 <p className="text-sm text-destructive">{errors.departmentName.message}</p>
               )}
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="roomNumber">Room Number</Label>
               <Input
                 id="roomNumber"
                 placeholder="101"
                 {...register('roomNumber')}
               />
               {errors.roomNumber && (
                 <p className="text-sm text-destructive">{errors.roomNumber.message}</p>
               )}
             </div>
 
             <Button type="submit" className="w-full" disabled={isLoading}>
               {isLoading ? 'Creating account...' : 'Sign Up'}
             </Button>
           </form>
 
           <p className="mt-6 text-center text-sm text-muted-foreground">
             Already have an account?{' '}
             <Link to="/login" className="text-primary hover:underline">
               Sign in
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
           <h3 className="mb-4 text-3xl font-bold">Become a Citizen</h3>
           <p className="text-lg text-muted-foreground">
             Join your hall's mini-nation. Contribute to tasks, build your social score, and help shape your community.
           </p>
         </div>
       </motion.div>
     </div>
   );
 }