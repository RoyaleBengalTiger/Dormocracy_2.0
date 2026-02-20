import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Users, Award, CheckCircle2, ArrowRight, Shield, Target } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

export default function Landing() {
  return (
    <div className="min-h-screen">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${heroBanner})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/70" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 mx-auto max-w-5xl px-6 text-center"
        >
          <div className="mb-6 flex justify-center">
            <Building2 className="h-20 w-20 text-primary" />
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
            Bureau of Halls
          </h1>

          <p className="mb-4 text-2xl text-primary md:text-3xl">
            A miniature nation-state for your dorm
          </p>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Where departments become countries, rooms become states, and mayors approve tasks.
            Welcome to formal bureaucratic governance for hall life.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Sign In
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Become a Citizen
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="animate-bounce text-muted-foreground">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </motion.div>
      </section>

      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold">How Your Hall Operates</h2>
            <p className="text-xl text-muted-foreground">
              A formal governance system for modern dorm living
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: 'Departments = Countries',
                description: 'Each department represents a sovereign nation within the Bureau. Your hall is divided into administrative territories.',
              },
              {
                icon: Users,
                title: 'Rooms = States',
                description: 'Your room is a state within your department. Collaborate with roommates under mayoral governance.',
              },
              {
                icon: Shield,
                title: 'Mayors Approve Tasks',
                description: 'Elected mayors review and approve all task requests, assign responsibilities, and validate completions.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="glass-card p-8 hover-lift"
              >
                <feature.icon className="mb-4 h-12 w-12 text-primary" />
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold">The Task Lifecycle</h2>
            <p className="text-xl text-muted-foreground">
              From proposal to completion, every task follows formal protocol
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                icon: Target,
                status: 'Pending Approval',
                description: 'Citizen submits a task request to their room\'s queue',
              },
              {
                icon: CheckCircle2,
                status: 'Active',
                description: 'Mayor approves and assigns task to a roommate',
              },
              {
                icon: Award,
                status: 'Awaiting Review',
                description: 'Assigned citizen completes task and submits summary',
              },
              {
                icon: Shield,
                status: 'Completed',
                description: 'Mayor reviews and accepts completion',
              },
            ].map((step, index) => (
              <motion.div
                key={step.status}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 flex items-start gap-4"
              >
                <div className="rounded-full p-3 bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-xl font-semibold">{step.status}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Award className="mx-auto mb-6 h-16 w-16 text-primary" />
            <h2 className="mb-4 text-4xl font-bold">Build Your Social Score</h2>
            <p className="mb-8 text-xl text-muted-foreground">
              Complete tasks, contribute to your room, and earn recognition. Your social score reflects
              your standing within the Bureau's meritocratic system.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-card mx-auto max-w-4xl p-12 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold">Ready to Join the Bureau?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Step into your hall's governance system. Every citizen matters.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Create Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t py-8 px-6">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Bureau of Halls. A formal governance system for hall life.</p>
        </div>
      </footer>
    </div>
  );
}