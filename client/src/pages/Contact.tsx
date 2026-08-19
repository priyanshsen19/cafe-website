import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Clock, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Reveal } from '@/components/common/Reveal';
import { publicApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  subject: z.string().trim().min(3, 'Add a subject').max(120),
  message: z.string().trim().min(10, 'Tell us a little more').max(2000),
});

type FormValues = z.infer<typeof schema>;

export default function Contact() {
  useSeo({
    title: 'Contact',
    description: 'Get in touch with ALAAP — enquiries, feedback, private events and wholesale coffee.',
    canonicalPath: '/contact',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await publicApi.contact({
        ...values,
        phone: values.phone?.trim() || undefined,
      });
      toast.success(result.message);
      reset();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to send your message.');
    }
  };

  return (
    <>
      <div className="border-b border-border bg-paper">
        <div className="container py-12 lg:py-16">
          <Reveal>
            <p className="eyebrow">Contact</p>
            <h1 className="mt-4 text-display-md text-foreground text-balance">Say hello</h1>
            <p className="mt-4 max-w-2xl font-sans text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
              Feedback, private events, wholesale coffee, or a lost umbrella — this all reaches the same inbox, and a
              real person reads it.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="container py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          {/* ── details ── */}
          <div>
            <Reveal>
              <h2 className="font-display text-xl text-foreground">Reach us directly</h2>
              <dl className="mt-6 space-y-6 font-sans text-sm">
                <div className="flex gap-3.5">
                  <dt>
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Phone</span>
                  </dt>
                  <dd>
                    <a href="tel:+918047182200" className="text-foreground transition-colors hover:text-accent">
                      +91 80 4718 2200
                    </a>
                    <p className="mt-1 text-muted-foreground">Indiranagar, 8:00 AM – 11:00 PM</p>
                  </dd>
                </div>

                <div className="flex gap-3.5">
                  <dt>
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Email</span>
                  </dt>
                  <dd>
                    <a href="mailto:hello@alaap.coffee" className="text-foreground transition-colors hover:text-accent">
                      hello@alaap.coffee
                    </a>
                    <p className="mt-1 text-muted-foreground">We reply within one working day.</p>
                  </dd>
                </div>

                <div className="flex gap-3.5">
                  <dt>
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Address</span>
                  </dt>
                  <dd>
                    <p className="text-foreground">12/3, 100 Feet Road, Indiranagar</p>
                    <p className="text-muted-foreground">Bengaluru, Karnataka 560038</p>
                  </dd>
                </div>

                <div className="flex gap-3.5">
                  <dt>
                    <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Opening hours</span>
                  </dt>
                  <dd>
                    <p className="text-foreground">Mon–Fri &nbsp;8:00 AM – 11:00 PM</p>
                    <p className="text-foreground">Sat–Sun &nbsp;8:00 AM – 12:00 AM</p>
                  </dd>
                </div>

                <div className="flex gap-3.5">
                  <dt>
                    <Instagram className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Social</span>
                  </dt>
                  <dd>
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-foreground transition-colors hover:text-accent"
                    >
                      @alaap.coffee
                    </a>
                    <p className="mt-1 text-muted-foreground">Daily specials and what came out of the oven.</p>
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>

          {/* ── form ── */}
          <Reveal delay={0.08}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="rounded-lg border border-border bg-card p-6 lg:p-8"
              noValidate
            >
              <h2 className="font-display text-xl text-foreground">Send us a note</h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    invalid={Boolean(errors.name)}
                    className="mt-1.5"
                    {...register('name')}
                  />
                  <FieldError>{errors.name?.message}</FieldError>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    invalid={Boolean(errors.email)}
                    className="mt-1.5"
                    {...register('email')}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </div>

                <div>
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    invalid={Boolean(errors.phone)}
                    className="mt-1.5"
                    {...register('phone')}
                  />
                  <FieldError>{errors.phone?.message}</FieldError>
                </div>

                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    invalid={Boolean(errors.subject)}
                    className="mt-1.5"
                    placeholder="Private event enquiry"
                    {...register('subject')}
                  />
                  <FieldError>{errors.subject?.message}</FieldError>
                </div>
              </div>

              <div className="mt-5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  invalid={Boolean(errors.message)}
                  className="mt-1.5"
                  placeholder="Tell us what you need…"
                  {...register('message')}
                />
                <FieldError>{errors.message?.message}</FieldError>
              </div>

              <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" loading={isSubmitting}>
                Send message
              </Button>
            </form>
          </Reveal>
        </div>
      </div>
    </>
  );
}
