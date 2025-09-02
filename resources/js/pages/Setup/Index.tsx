import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Head, useForm } from '@inertiajs/react';
import ParticlesBackground from '@/components/ParticlesBackground';
import {
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  ShieldCheck,
  Rocket,
  Settings2,
  X,
  ExternalLink,
  Building2,
  Type,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
} from 'lucide-react';

/* Indicatifs + longueurs (numéro national, sans 0 initial) */
const COUNTRIES = [
  { iso: 'MA', name: 'Maroc',       dial: '+212', lengths: [9] },
  { iso: 'FR', name: 'France',      dial: '+33',  lengths: [9] },
  { iso: 'ES', name: 'Espagne',     dial: '+34',  lengths: [9] },
  { iso: 'DE', name: 'Allemagne',   dial: '+49',  lengths: [10, 11] },
  { iso: 'GB', name: 'Royaume-Uni', dial: '+44',  lengths: [10] },
  { iso: 'US', name: 'États-Unis',  dial: '+1',   lengths: [10] },
  { iso: 'CA', name: 'Canada',      dial: '+1',   lengths: [10] },
  { iso: 'IT', name: 'Italie',      dial: '+39',  lengths: [9, 10] },
  { iso: 'BE', name: 'Belgique',    dial: '+32',  lengths: [8, 9] },
  { iso: 'NL', name: 'Pays-Bas',    dial: '+31',  lengths: [9] },
] as const;

type Country = typeof COUNTRIES[number];
type SettingsProps = { settings?: any };

/* Helpers */
const isNonEmpty = (v?: string) => Boolean((v ?? '').trim());
const isValidEmail = (v?: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidUrl = (v?: string) => !!v && /^(https?:\/\/)[\w.-]+(\.[\w.-]+)+[/#?]?.*$/i.test(v.trim());

const SetupIndex: React.FC<SettingsProps> = ({ settings }) => {
  const { data, setData, post, processing, errors, clearErrors } = useForm({
    company_name: settings?.company_name ?? '',
    app_slogan: settings?.app_slogan ?? '',
    contact_email: settings?.contact_email ?? '',
    contact_phone: settings?.contact_phone ?? '', // sera rempli au submit (format international)
    contact_address: settings?.contact_address ?? '',
    cgu_url: settings?.cgu_url ?? '',
    privacy_url: settings?.privacy_url ?? '',
    copyright: settings?.copyright ?? '',
    meta_keywords: settings?.meta_keywords ?? '',
    meta_description: settings?.meta_description ?? '',
    twitter: settings?.social_links?.twitter ?? '',
    facebook: settings?.social_links?.facebook ?? '',
    instagram: settings?.social_links?.instagram ?? '',
    linkedin: settings?.social_links?.linkedin ?? '',
    logo: null as File | null,
    logo_dark: null as File | null,
    favicon: null as File | null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  // Téléphone
  const [country, setCountry] = useState<Country>(COUNTRIES[0]); // défaut Maroc
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [nationalNumber, setNationalNumber] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Modal CGU
  const [showTerms, setShowTerms] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);

  const logoRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const baseInput =
    'block w-full rounded-lg border py-3 px-3 bg-white dark:bg-slate-800 ' +
    'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700 ' +
    'focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';
  const errorInput =
    'block w-full rounded-lg border py-3 px-3 bg-white dark:bg-slate-800 ' +
    'border-red-500 text-red-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

  function setFilePreview(file: File | null, setter: (v: string | null) => void) {
    if (!file) return setter(null);
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, type, value, files } = e.target as any;
    if (type === 'file') {
      const file = files?.[0] ?? null;
      setData(name, file);
      clearErrors(name);
      if (name === 'logo') setFilePreview(file, setLogoPreview);
      if (name === 'logo_dark') setFilePreview(file, setLogoDarkPreview);
      if (name === 'favicon') setFilePreview(file, setFaviconPreview);
      return;
    }
    setData(name, value);
    clearErrors(name);
  }

  // helpers téléphone
  const onlyDigits = (v: string) => v.replace(/\D/g, '');
  const isoToFlag = (iso: string) => iso.replace(/./g, c => String.fromCodePoint(127397 + c.toUpperCase().charCodeAt(0)));
  const expectedLengths = country.lengths;
  const maxLen = Math.max(...expectedLengths);
  const fullInternational = `${country.dial}${nationalNumber}`;
  const isPhoneValidPure = (len = nationalNumber.length) => !!nationalNumber && expectedLengths.includes(len);
  function validatePhone(len = nationalNumber.length) {
    if (!expectedLengths.includes(len)) {
      const pretty = expectedLengths.map(String).join(' ou ');
      setPhoneError(`Le numéro doit contenir ${pretty} chiffres pour ${country.name}.`);
      return false;
    }
    setPhoneError(null);
    return true;
  }

  // Progression granulaire (13 items) — requis: company_name + logo
  const progress = useMemo(() => {
    const items = [
      { key: 'company_name',    done: isNonEmpty(data.company_name) }, // requis
      { key: 'logo',            done: !!data.logo },                   // requis
      { key: 'logo_dark',       done: !!data.logo_dark },
      { key: 'favicon',         done: !!data.favicon },
      { key: 'app_slogan',      done: isNonEmpty(data.app_slogan) },
      { key: 'contact_email',   done: isValidEmail(data.contact_email) },
      { key: 'contact_phone',   done: isPhoneValidPure() },
      { key: 'contact_address', done: isNonEmpty(data.contact_address) },
      { key: 'cgu_url',         done: isValidUrl(data.cgu_url) },
      { key: 'privacy_url',     done: isValidUrl(data.privacy_url) },
      { key: 'copyright',       done: isNonEmpty(data.copyright) },
      { key: 'meta_keywords',   done: isNonEmpty(data.meta_keywords) },
      { key: 'meta_description',done: isNonEmpty(data.meta_description) },
      // NOTE: liens sociaux optionnels — non comptés dans la progression pour ne pas pénaliser
    ];
    const total = items.length;
    const completed = items.filter(i => i.done).length;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent };
  }, [
    data.company_name, data.logo, data.logo_dark, data.favicon,
    data.app_slogan, data.contact_email, data.contact_address,
    data.cgu_url, data.privacy_url, data.copyright,
    data.meta_keywords, data.meta_description,
    nationalNumber, expectedLengths
  ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (nationalNumber) {
      if (!validatePhone()) return;
      setData('contact_phone', fullInternational);
    } else {
      setData('contact_phone', '');
    }

    setIsLoading(true);
    post(route('setup.store'), {
      forceFormData: true,
      onFinish: () => setIsLoading(false),
    });
  }

  // Modal ESC
  useEffect(() => {
    if (!showTerms) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTerms(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTerms]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
      <Head title="Configuration de l’application" />
      <ParticlesBackground />

      {/* HERO */}
      <header className="relative z-10 px-4 pt-16 sm:pt-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white">
            <ShieldCheck className="h-4 w-4" />
            Assistant de configuration — X-Panel
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Démarrez votre espace en quelques secondes
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Renseignez la <span className="font-semibold">raison sociale</span>, votre logo et les informations clés. Vous pourrez tout modifier plus tard dans
            <span className="font-semibold"> Paramètres</span>.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="inline-flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Rapide
            </div>
            <div className="inline-flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Flexible
            </div>
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Réversible
            </div>
          </div>
        </div>
      </header>

      {/* CARD */}
      <main className="relative z-10 px-4 pb-16 pt-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/70 shadow-xl ring-1 ring-slate-200 backdrop-blur dark:bg-white/10 dark:ring-white/10">
          {/* Progress */}
          <div className="px-6 pt-6 sm:px-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Progression — {progress.completed}/{progress.total} champs · {progress.percent}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Champs requis&nbsp;: <strong>Raison sociale</strong>, <strong>Logo</strong>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          <form onSubmit={submit} className="px-6 pb-8 pt-6 sm:px-8 sm:pt-8 space-y-10">
            {/* Identité */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Identité</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Définissez la raison sociale de l’entreprise (le nom de l’application est figé par défaut).
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="company_name">
                    Raison sociale de l’entreprise <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="company_name"
                      name="company_name"
                      value={data.company_name}
                      onChange={handleChange}
                      placeholder="Global Glimpse S.A.R.L / ACME Inc."
                      className={(errors.company_name ? errorInput : baseInput) + ' pl-10'}
                    />
                  </div>
                  {errors.company_name && <p className="mt-1 text-sm text-red-500">{errors.company_name}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="app_slogan">
                    Slogan (optionnel)
                  </label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="app_slogan"
                      name="app_slogan"
                      value={data.app_slogan}
                      onChange={handleChange}
                      placeholder="L’excellence de la gestion…"
                      className={errors.app_slogan ? errorInput + ' pl-10' : baseInput + ' pl-10'}
                    />
                  </div>
                  {errors.app_slogan && <p className="mt-1 text-sm text-red-500">{errors.app_slogan}</p>}
                </div>
              </div>
            </section>

            {/* Logos & icône */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Logos & Icône</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Téléversez votre logo clair, sombre et un favicon.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Logo clair (requis) */}
                <div className="rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Logo clair <span className="text-red-500">*</span>
                    </span>
                    {logoPreview && <img src={logoPreview} alt="Logo clair" className="h-6 rounded" />}
                  </div>
                  <label
                    htmlFor="logo"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-6 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <ImageIcon className="h-5 w-5" />
                    Sélectionner un fichier
                  </label>
                  <input
                    id="logo"
                    name="logo"
                    type="file"
                    ref={logoRef}
                    onChange={(e: any) => { handleChange(e); setFilePreview(e.target.files?.[0] ?? null, setLogoPreview); }}
                    accept="image/*"
                    className="hidden"
                  />
                  {errors.logo && <p className="mt-2 text-xs text-red-500">{errors.logo}</p>}
                </div>

                {/* Logo sombre */}
                <div className="rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Logo sombre</span>
                    {logoDarkPreview && <img src={logoDarkPreview} alt="Logo sombre" className="h-6 rounded bg-slate-900" />}
                  </div>
                  <label
                    htmlFor="logo_dark"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-6 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <ImageIcon className="h-5 w-5" />
                    Sélectionner un fichier
                  </label>
                  <input
                    id="logo_dark"
                    name="logo_dark"
                    type="file"
                    ref={logoDarkRef}
                    onChange={(e: any) => { handleChange(e); setFilePreview(e.target.files?.[0] ?? null, setLogoDarkPreview); }}
                    accept="image/*"
                    className="hidden"
                  />
                  {errors.logo_dark && <p className="mt-2 text-xs text-red-500">{errors.logo_dark}</p>}
                </div>

                {/* Favicon */}
                <div className="rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Favicon</span>
                    {faviconPreview && <img src={faviconPreview} alt="Favicon" className="h-6 w-6 rounded bg-white" />}
                  </div>
                  <label
                    htmlFor="favicon"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-6 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <ImageIcon className="h-5 w-5" />
                    Sélectionner un fichier
                  </label>
                  <input
                    id="favicon"
                    name="favicon"
                    type="file"
                    ref={faviconRef}
                    onChange={(e: any) => { handleChange(e); setFilePreview(e.target.files?.[0] ?? null, setFaviconPreview); }}
                    accept="image/png, image/x-icon"
                    className="hidden"
                  />
                  {errors.favicon && <p className="mt-2 text-xs text-red-500">{errors.favicon}</p>}
                </div>
              </div>
            </section>

            {/* Coordonnées */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Coordonnées</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Ces informations apparaîtront sur vos documents et votre pied de page.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="contact_email">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        id="contact_email"
                        name="contact_email"
                        value={data.contact_email}
                        onChange={handleChange}
                        placeholder="contact@exemple.com"
                        className={(!errors.contact_email ? baseInput : errorInput) + ' pl-10'}
                      />
                    </div>
                    {errors.contact_email && <p className="mt-1 text-sm text-red-500">{errors.contact_email}</p>}
                  </div>

                  {/* Téléphone : drapeau + indicatif + input national */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="contact_phone">
                      Téléphone
                    </label>

                    <div className="relative">
                      <div className="relative flex items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 focus-within:ring-1 focus-within:ring-red-500">
                        <button
                          type="button"
                          onClick={() => setShowCountryMenu(v => !v)}
                          className="flex items-center gap-2 px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
                          aria-haspopup="listbox"
                          aria-expanded={showCountryMenu}
                        >
                          <span className="text-lg">{isoToFlag(country.iso)}</span>
                          <span className="text-slate-600 dark:text-slate-300">{country.dial}</span>
                        </button>

                        <div className="relative flex-1">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            id="contact_phone"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="612345678"
                            value={nationalNumber}
                            maxLength={maxLen}
                            onChange={(e) => {
                              const digits = onlyDigits(e.target.value);
                              setNationalNumber(digits);
                              if (phoneError) setPhoneError(null);
                            }}
                            onBlur={() => nationalNumber && validatePhone()}
                            className={(phoneError ? errorInput : baseInput) + ' border-0 pl-10'}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
                            {nationalNumber.length}/{maxLen}
                          </div>
                        </div>
                      </div>

                      {showCountryMenu && (
                        <ul
                          role="listbox"
                          className="absolute z-20 mt-1 max-h-60 w-64 overflow-auto rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
                        >
                          {COUNTRIES.map((c) => (
                            <li
                              key={c.iso}
                              role="option"
                              aria-selected={country.iso === c.iso}
                              onClick={() => {
                                setCountry(c);
                                setShowCountryMenu(false);
                                if (nationalNumber) validatePhone();
                              }}
                              className={
                                'flex cursor-pointer items-center justify-between rounded px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 ' +
                                (country.iso === c.iso ? 'bg-slate-50 dark:bg-slate-700' : '')
                              }
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-lg">{isoToFlag(c.iso)}</span>
                                <span className="text-slate-800 dark:text-slate-200">{c.name}</span>
                              </span>
                              <span className="text-slate-500 dark:text-slate-300">{c.dial}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {phoneError && <p className="mt-1 text-sm text-red-500">{phoneError}</p>}
                    {!phoneError && nationalNumber && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Numéro complet&nbsp;: <strong>{country.dial}{nationalNumber}</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="contact_address">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      id="contact_address"
                      name="contact_address"
                      value={data.contact_address}
                      onChange={handleChange}
                      placeholder="Adresse complète"
                      className={(!errors.contact_address ? baseInput : errorInput) + ' pl-10'}
                    />
                  </div>
                  {errors.contact_address && <p className="mt-1 text-sm text-red-500">{errors.contact_address}</p>}
                </div>
              </div>
            </section>

            {/* Réseaux sociaux */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Réseaux sociaux</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Renseignez des URLs complètes <em>ou</em> des @handles. Ces champs sont optionnels.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="twitter">
                    Twitter
                  </label>
                  <div className="relative">
                    <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="twitter"
                      name="twitter"
                      value={data.twitter}
                      onChange={handleChange}
                      placeholder="https://twitter.com/votrecompte ou @votrecompte"
                      className={baseInput + ' pl-10'}
                    />
                  </div>
                  {errors.twitter && <p className="mt-1 text-sm text-red-500">{errors.twitter}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="facebook">
                    Facebook
                  </label>
                  <div className="relative">
                    <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="facebook"
                      name="facebook"
                      value={data.facebook}
                      onChange={handleChange}
                      placeholder="https://www.facebook.com/votrepage"
                      className={baseInput + ' pl-10'}
                    />
                  </div>
                  {errors.facebook && <p className="mt-1 text-sm text-red-500">{errors.facebook}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="instagram">
                    Instagram
                  </label>
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="instagram"
                      name="instagram"
                      value={data.instagram}
                      onChange={handleChange}
                      placeholder="https://www.instagram.com/votrecompte"
                      className={baseInput + ' pl-10'}
                    />
                  </div>
                  {errors.instagram && <p className="mt-1 text-sm text-red-500">{errors.instagram}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="linkedin">
                    LinkedIn
                  </label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="linkedin"
                      name="linkedin"
                      value={data.linkedin}
                      onChange={handleChange}
                      placeholder="https://www.linkedin.com/company/votre-societe/"
                      className={baseInput + ' pl-10'}
                    />
                  </div>
                  {errors.linkedin && <p className="mt-1 text-sm text-red-500">{errors.linkedin}</p>}
                </div>
              </div>
            </section>

            {/* Mentions & SEO */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Mentions & SEO</h2>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cgu_url">
                      URL des CGU
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        id="cgu_url"
                        name="cgu_url"
                        value={data.cgu_url}
                        onChange={handleChange}
                        placeholder="https://…"
                        className={(!errors.cgu_url ? baseInput : errorInput) + ' pl-10'}
                      />
                    </div>
                    {errors.cgu_url && <p className="mt-1 text-sm text-red-500">{errors.cgu_url}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="privacy_url">
                      Politique de confidentialité
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        id="privacy_url"
                        name="privacy_url"
                        value={data.privacy_url}
                        onChange={handleChange}
                        placeholder="https://…"
                        className={(!errors.privacy_url ? baseInput : errorInput) + ' pl-10'}
                      />
                    </div>
                    {errors.privacy_url && <p className="mt-1 text-sm text-red-500">{errors.privacy_url}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="copyright">
                    Copyright
                  </label>
                  <input
                    id="copyright"
                    name="copyright"
                    value={data.copyright}
                    onChange={handleChange}
                    placeholder="© 2025 Votre Société. Tous droits réservés."
                    className={(!errors.copyright ? baseInput : errorInput)}
                  />
                  {errors.copyright && <p className="mt-1 text-sm text-red-500">{errors.copyright}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="meta_keywords">
                      Mots-clés
                    </label>
                    <textarea
                      id="meta_keywords"
                      name="meta_keywords"
                      rows={2}
                      value={data.meta_keywords}
                      onChange={handleChange}
                      className={!errors.meta_keywords ? baseInput : errorInput}
                    />
                    {errors.meta_keywords && <p className="mt-1 text-sm text-red-500">{errors.meta_keywords}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="meta_description">
                      Description (SEO)
                    </label>
                    <textarea
                      id="meta_description"
                      name="meta_description"
                      rows={2}
                      value={data.meta_description}
                      onChange={handleChange}
                      className={!errors.meta_description ? baseInput : errorInput}
                    />
                    {errors.meta_description && <p className="mt-1 text-sm text-red-500">{errors.meta_description}</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Vous pourrez modifier ces réglages plus tard dans <span className="font-medium">Paramètres</span>.
              </p>
              <button
                type="submit"
                disabled={processing || isLoading}
                className="group inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500 disabled:opacity-70"
              >
                {(processing || isLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {(processing || isLoading) ? 'Enregistrement…' : 'Terminer la configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Bandeau légal + attribution */}
        <div className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-500 dark:text-slate-400">
          En continuant, vous acceptez les éventuelles{' '}
          <button
            type="button"
            onClick={() => { setTermsLoading(true); setShowTerms(true); }}
            className="underline decoration-dotted text-slate-700 hover:text-red-500 dark:text-slate-200"
          >
            conditions d’utilisation
          </button>
          .
          <div className="mt-1">Conception et Développement par @globalglimpse.ma</div>
        </div>
      </main>

      {/* Modal CGU */}
      {showTerms && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowTerms(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/90 shadow-2xl backdrop-blur dark:bg-slate-900/90">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 px-4 py-3 dark:border-white/10">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Conditions d’utilisation
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={route('setup.terms')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-600 dark:text-slate-300"
                >
                  Ouvrir dans un nouvel onglet <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowTerms(false)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative h-[75vh]">
              {termsLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              )}
              <iframe
                title="Conditions d’utilisation"
                src={route('setup.terms')}
                onLoad={() => setTermsLoading(false)}
                className="h-full w-full rounded-b-2xl bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupIndex;
