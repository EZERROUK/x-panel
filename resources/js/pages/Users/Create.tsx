import React, { useEffect, useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import {
  User, Mail, Shield,
  Eye, EyeOff, ChevronDown,
  UserPlus, ArrowLeft, UserCog,
  Wand2, CheckCircle2, XCircle, Copy
} from 'lucide-react';

import AppLayout           from '@/layouts/app-layout';
import ParticlesBackground from '@/components/ParticlesBackground';
import { Button }          from '@/components/ui/button';

interface Role  { id: number; name: string }
interface Props { roles: Role[] }

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers — sécurité & UX                                                     */
const hasLower = (s: string) => /[a-z]/.test(s);
const hasUpper = (s: string) => /[A-Z]/.test(s);
const hasDigit = (s: string) => /\d/.test(s);
const minLen  = (s: string, n = 10) => s.length >= n;

const pwdOK = (p: string) => hasLower(p) && hasUpper(p) && hasDigit(p) && minLen(p, 10);

function generatePassword(length = 14) {
  // Charset volontairement limité pour éviter les caractères ambigus
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@$%^&*?';
  const pools = [lowers, uppers, digits, specials];

  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];

  // Garantir au moins un de chaque catégorie principale (hors specials qui restent un bonus)
  let result = pick(lowers) + pick(uppers) + pick(digits);
  const all = lowers + uppers + digits + specials;

  const cryptoOK = typeof window !== 'undefined' && window.crypto && 'getRandomValues' in window.crypto;
  if (cryptoOK) {
    const bytes = new Uint32Array(length);
    window.crypto.getRandomValues(bytes);
    for (let i = result.length; i < length; i++) result += all[bytes[i] % all.length];
  } else {
    while (result.length < length) result += all[Math.floor(Math.random() * all.length)];
  }

  // Mélanger
  return result
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export default function CreateUser({ roles }: Props) {
  /* ─── État Inertia ─── */
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '', email: '', role: '', password: '', password_confirmation: '',
  });

  /* ─── État local ─── */
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdErr,      setPwdErr]      = useState('');
  const [justGenerated, setJustGenerated] = useState(false);

  /* ─── Validation en direct ─── */
  const criteria = useMemo(() => ({
    length: minLen(data.password, 10),
    lower:  hasLower(data.password),
    upper:  hasUpper(data.password),
    digit:  hasDigit(data.password),
  }), [data.password]);

  const allCriteriaOK = criteria.length && criteria.lower && criteria.upper && criteria.digit;
  const passwordsMatch = data.password && data.password === data.password_confirmation;

  useEffect(() => {
    // Nettoyer l'erreur manuelle si l'utilisateur corrige
    if (pwdErr && allCriteriaOK) setPwdErr('');
  }, [pwdErr, allCriteriaOK]);

  const handleGenerate = () => {
    const pwd = generatePassword(16);
    setData('password', pwd);
    setData('password_confirmation', pwd);
    setShowPwd(true);
    setShowConfirm(true);
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 2500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.password);
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 1500);
    } catch { /* noop */ }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pwdOK(data.password))
      return setPwdErr('10 car. min. + maj + min + chiffre');
    if (data.password !== data.password_confirmation)
      return setPwdErr('Les mots de passe ne correspondent pas');

    setPwdErr('');
    post(route('users.store'), data, { onSuccess: () => reset() });
  };

  /* ─────────────────────────────────────────── */
  return (
    <>
      <Head title="Créer un utilisateur" />

      <div className="relative min-h-screen bg-gradient-to-br
                      from-white via-slate-100 to-slate-200
                      dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]
                      transition-colors duration-500">
        <ParticlesBackground />

        <AppLayout breadcrumbs={[
          { title: 'Dashboard',    href: '/dashboard' },
          { title: 'Utilisateurs', href: '/users' },
          { title: 'Créer',        href: '/users/create' },
        ]}>

          <div className="grid grid-cols-12 gap-6 p-6">

            {/* ────────── Formulaire ────────── */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-7">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl
                              dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-8">
                <h1 className="text-xl font-semibold mb-6 text-slate-900 dark:text-white">
                  Nouvel utilisateur
                </h1>

                <form onSubmit={submit} className="space-y-6">
                  {/* Nom */}
                  <Field id="name" label="Nom complet" Icon={User}
                         value={data.name} onChange={v => setData('name', v)}
                         error={errors.name} required />

                  {/* Email */}
                  <Field id="email" label="Adresse e-mail" Icon={Mail} type="email"
                         value={data.email} onChange={v => setData('email', v)}
                         error={errors.email} required autoComplete="new-email" />

                  {/* Rôle */}
                  <div>
                    <label
                      htmlFor="role"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Rôle utilisateur <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />

                      <select
                        id="role"
                        name="role"
                        required
                        value={data.role}
                        onChange={e => setData('role', e.target.value)}
                        className={`appearance-none block w-full rounded-lg border py-3 pl-10 pr-10 bg-white dark:bg-slate-800
                                    ${errors.role ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
                                    focus:border-red-500 focus:ring-1 focus:ring-red-500`}
                      >
                        <option value="" disabled>Choisissez un rôle</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>

                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    </div>

                    {errors.role && (
                      <p className="mt-1 text-sm text-red-500">{errors.role}</p>
                    )}
                  </div>

                  {/* Mot de passe */}
                  <PasswordField
                    id="password"
                    label="Mot de passe"
                    Icon={Shield}
                    show={showPwd}
                    toggleShow={() => setShowPwd(!showPwd)}
                    value={data.password}
                    onChange={v => setData('password', v)}
                    error={pwdErr || errors.password}
                    onGenerate={handleGenerate}
                    onCopy={handleCopy}
                    justGenerated={justGenerated}
                  />

                  {/* Checklist dynamique */}
                  <PasswordChecklist
                    showOK={allCriteriaOK}
                    criteria={criteria}
                  />

                  {/* Confirmation */}
                  <PasswordField
                    id="password_confirmation"
                    label="Confirmer le mot de passe"
                    Icon={Shield}
                    show={showConfirm}
                    toggleShow={() => setShowConfirm(!showConfirm)}
                    value={data.password_confirmation}
                    onChange={v => setData('password_confirmation', v)}
                    error={errors.password_confirmation}
                  />

                  {/* Aide visuelle sur la correspondance */}
                  {data.password_confirmation && (
                    <p className={`text-sm ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`} aria-live="polite">
                      {passwordsMatch ? '✅ Les mots de passe correspondent' : '❌ Les mots de passe ne correspondent pas'}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => window.history.back()}
                      className="bg-muted hover:bg-muted/80 text-slate-700 dark:text-slate-300"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Annuler
                    </Button>

                    <Button
                      type="submit"
                      disabled={processing}
                      className="group relative flex items-center justify-center
                                 rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-6 py-3
                                 text-sm font-semibold text-white shadow-md transition-all
                                 hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500 disabled:opacity-60"
                    >
                      {processing
                        ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />)
                        : (<UserPlus className="w-4 h-4 mr-2" />)}
                      {processing ? 'Création…' : "Créer l'utilisateur"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* ────────── Aide ────────── */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl
                              dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-8">
                <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-white">
                  Bonnes pratiques de sécurité
                </h2>
                <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                  <li>Mot de passe : 10+ caractères, majuscule, minuscule et chiffre</li>
                  <li>Un générateur intégré est disponible sur le champ Mot de passe</li>
                  <li>L’e-mail doit être unique</li>
                  <li>Le rôle détermine les permissions attribuées</li>
                </ul>
              </div>
            </div>

          </div>
        </AppLayout>
      </div>
    </>
  );
}

/* ────────── Composants réutilisables ────────── */
interface FieldProps {
  id: string; label: string; Icon: any;
  type?: React.HTMLInputTypeAttribute; required?: boolean;
  value: string; onChange: (v: string) => void; autoComplete?: string;
  error?: string | false;
}
function Field({ id, label, Icon, type = 'text', required = true, value, onChange, autoComplete, error }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className={`block w-full rounded-lg border py-3 pl-10 pr-3 bg-white dark:bg-slate-800
                      ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
                      focus:border-red-500 focus:ring-1 focus:ring-red-500`}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

interface PasswordFieldProps {
  id: string; label: string; Icon: any; show: boolean; toggleShow: () => void;
  value: string; onChange: (v: string) => void; error?: string | false;
  onGenerate?: () => void; onCopy?: () => void; justGenerated?: boolean;
}
function PasswordField({ id, label, Icon, show, toggleShow, value, onChange, error, onGenerate, onCopy, justGenerated }: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          required
          value={value}
          autoComplete="new-password"
          onChange={e => onChange(e.target.value)}
          className={`block w-full rounded-lg border py-3 pl-10 pr-24 bg-white dark:bg-slate-800
                      ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
                      focus:border-red-500 focus:ring-1 focus:ring-red-500`}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
        />
        {/* Actions à droite : Générer | Copier | Voir */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {onGenerate && (
            <button type="button" onClick={onGenerate} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60" title="Proposer un mot de passe fort">
              <Wand2 className={`h-5 w-5 ${justGenerated ? 'text-green-500' : 'text-slate-400'}`} />
            </button>
          )}
          {onCopy && value && (
            <button type="button" onClick={onCopy} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60" title="Copier">
              <Copy className={`h-5 w-5 ${justGenerated ? 'text-green-500' : 'text-slate-400'}`} />
            </button>
          )}
          <button type="button" onClick={toggleShow} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {show ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function PasswordChecklist({ criteria, showOK }: { criteria: { length: boolean; lower: boolean; upper: boolean; digit: boolean; }, showOK: boolean }) {
  if (showOK) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" aria-live="polite">
        <CheckCircle2 className="h-5 w-5" />
        <span id="password-help">Mot de passe conforme aux critères</span>
      </div>
    );
  }

  const Row = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={`flex items-center gap-2 ${ok ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-red-500'}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span>{label}</span>
    </li>
  );

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-900/10 p-3">
      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Critères requis :</p>
      <ul className="text-sm space-y-1">
        <Row ok={criteria.length} label="Au moins 10 caractères" />
        <Row ok={criteria.upper}  label="Au moins une majuscule" />
        <Row ok={criteria.lower}  label="Au moins une minuscule" />
        <Row ok={criteria.digit}  label="Au moins un chiffre" />
      </ul>
    </div>
  );
}
