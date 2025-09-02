import React from 'react';
import { Head, Link } from '@inertiajs/react';
import ParticlesBackground from '@/components/ParticlesBackground';
import {
  ShieldCheck,
  ChevronLeft,
  FileText,
  UserCheck,
  HeartHandshake,
  Lock,
  BadgeCheck,
  AlertTriangle,
  RefreshCw,
  Mail
} from 'lucide-react';

type Props = { settings?: any };

const SectionTitle = ({
  id,
  icon: Icon,
  number,
  title,
  subtitle,
}: {
  id: string;
  icon: React.ElementType;
  number: string;
  title: string;
  subtitle?: string;
}) => (
  <div id={id} className="flex items-start gap-3">
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-500 text-white shadow-md">
        <Icon className="h-5 w-5" />
      </div>
      <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 dark:bg-slate-900 dark:text-red-400 dark:ring-white/10">
        {number}
      </span>
    </div>
    <div>
      <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      )}
      <div className="mt-3 h-0.5 w-16 rounded-full bg-gradient-to-r from-red-500 to-red-400" />
    </div>
  </div>
);

const PillLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    className="whitespace-nowrap rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-red-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
  >
    {children}
  </a>
);

const ConditionsUtilisation: React.FC<Props> = ({ settings }) => {
  const appName  = settings?.app_name ?? 'X-Panel';
  const contact  = settings?.contact_email ?? 'support@x-panel.ma';

  // Date "Dernière mise à jour" (on privilégie la fin d’onboarding si dispo)
  const lastUpdateISO   = settings?.onboarded_at ?? null;
  const lastUpdateDate  = lastUpdateISO ? new Date(lastUpdateISO) : new Date();
  const lastUpdateLabel = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(lastUpdateDate);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
      <Head title="Conditions d’utilisation" />
      <ParticlesBackground />

      {/* HERO */}
      <header className="relative z-10 px-4 pt-12 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/60 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white">
            <ShieldCheck className="h-4 w-4" />
            Conditions d’utilisation — {appName}
          </div>
          <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">
            Règles d’utilisation et cadre légal
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Dernière mise à jour : {lastUpdateLabel}
          </p>

          {/* Sommaire “pills” */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <PillLink href="#objet">Objet</PillLink>
            <PillLink href="#compte">Accès & comptes</PillLink>
            <PillLink href="#acceptable">Utilisation acceptable</PillLink>
            <PillLink href="#donnees">Données & confidentialité</PillLink>
            <PillLink href="#ip">Propriété intellectuelle</PillLink>
            <PillLink href="#responsabilite">Responsabilité</PillLink>
            <PillLink href="#modifs">Modifications</PillLink>
            <PillLink href="#contact">Contact</PillLink>
          </div>
        </div>
      </header>

      {/* CARD */}
      <main className="relative z-10 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/80 p-6 shadow-xl ring-1 ring-slate-200 backdrop-blur dark:bg-white/10 dark:ring-white/10">
          {/* Bouton retour (Inertia Link) */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={route('setup.show')}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-red-500 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" /> Retour
            </Link>
          </div>

          {/* 1. Objet */}
          <section className="space-y-4">
            <SectionTitle
              id="objet"
              icon={FileText}
              number="1"
              title="Objet"
              subtitle={`Ces conditions encadrent l’utilisation de ${appName}. En accédant au service, vous les acceptez intégralement.`}
            />
            <ul className="mt-2 grid gap-2">
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                Définir un cadre clair d’utilisation et de responsabilité entre {appName} et ses utilisateurs.
              </li>
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                Préciser les droits, obligations et limitations applicables.
              </li>
            </ul>
          </section>

          {/* 2. Accès & comptes */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="compte"
              icon={UserCheck}
              number="2"
              title="Accès & comptes"
              subtitle="Vous êtes responsable de la confidentialité de vos identifiants et des actions liées à votre compte."
            />
            <ul className="mt-2 grid gap-2">
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                Sécurisez vos mots de passe et limitez l’accès à des personnes autorisées.
              </li>
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                Signalez immédiatement tout accès non autorisé.
              </li>
            </ul>
          </section>

          {/* 3. Utilisation acceptable */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="acceptable"
              icon={HeartHandshake}
              number="3"
              title="Utilisation acceptable"
              subtitle="Agissez de manière légale, respectueuse et conforme aux droits des tiers."
            />
            <ul className="mt-2 grid gap-2">
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                Aucune activité illégale, abusive, diffamatoire, frauduleuse ou intrusive.
              </li>
              <li className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                Pas d’ingénierie inverse, d’attaque, de saturation ou de contournement de sécurité.
              </li>
            </ul>
          </section>

          {/* 4. Données & confidentialité */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="donnees"
              icon={Lock}
              number="4"
              title="Données & confidentialité"
              subtitle="Vos données sont traitées conformément à notre politique dédiée."
            />
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:from-white/10 dark:to-white/5 dark:text-slate-200">
              Pour toute question relative à vos données, écrivez-nous à{' '}
              <a
                className="font-semibold text-red-600 underline decoration-dotted hover:text-red-500"
                href={`mailto:${contact}`}
              >
                {contact}
              </a>.
            </div>
          </section>

          {/* 5. Propriété intellectuelle */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="ip"
              icon={BadgeCheck}
              number="5"
              title="Propriété intellectuelle"
              subtitle="Marques, logos, interfaces et contenus demeurent la propriété de leurs titulaires."
            />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Toute reproduction, adaptation ou diffusion non autorisée est interdite.
            </p>
          </section>

          {/* 6. Limitation de responsabilité */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="responsabilite"
              icon={AlertTriangle}
              number="6"
              title="Limitation de responsabilité"
              subtitle={`Dans la limite autorisée par la loi, ${appName} ne peut être tenu responsable des dommages indirects, consécutifs ou punitifs.`}
            />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Le service est fourni « en l’état ». Certaines fonctionnalités peuvent dépendre de services tiers.
            </p>
          </section>

          {/* 7. Modifications */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="modifs"
              icon={RefreshCw}
              number="7"
              title="Modifications"
              subtitle="Nous pouvons adapter ces conditions ; les changements s’appliquent dès publication."
            />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Nous vous recommandons de consulter régulièrement cette page.
            </p>
          </section>

          {/* 8. Contact */}
          <section className="mt-10 space-y-4">
            <SectionTitle
              id="contact"
              icon={Mail}
              number="8"
              title="Contact"
              subtitle="Une question sur ces conditions ?"
            />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Écrivez-nous à{' '}
              <a
                className="font-semibold text-red-600 underline decoration-dotted hover:text-red-500"
                href={`mailto:${contact}`}
              >
                {contact}
              </a>.
            </p>
          </section>
        </div>

        {/* Bandeau d’info + attribution, même endroit que sur setup */}
        <div className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-500 dark:text-slate-400">
          Vous consultez les <span className="font-semibold">conditions d’utilisation</span> de {appName}.<br />
          <span className="mt-1 block">Conception et Développement par @globalglimpse.ma</span>
        </div>
      </main>
    </div>
  );
};

export default ConditionsUtilisation;
