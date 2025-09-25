import { Head, useForm } from '@inertiajs/react'
import { useRef } from 'react'
import { BreadcrumbItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import InputError from '@/components/input-error'
import HeadingSmall from '@/components/heading-small'
import AppLayout from '@/layouts/app-layout'
import SettingsLayout from '@/layouts/settings/layout'

const fieldClass =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ' +
  'placeholder:text-muted-foreground shadow-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:border-slate-700 dark:text-white dark:placeholder-slate-400'

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Paramètres généraux', href: '/settings/app' },
]

export default function AppSettings({
  settings,
  flash,
}: {
  settings: any
  flash?: { success?: string }
}) {
  const { data, setData, post, processing, errors, recentlySuccessful } =
    useForm({
      // on garde app_name en lecture seule, et on édite company_name
      company_name: settings.company_name ?? '',
      app_slogan: settings.app_slogan ?? '',
      contact_email: settings.contact_email ?? '',
      contact_phone: settings.contact_phone ?? '',
      contact_address: settings.contact_address ?? '',
      cgu_url: settings.cgu_url ?? '',
      privacy_url: settings.privacy_url ?? '',
      copyright: settings.copyright ?? '',
      meta_keywords: settings.meta_keywords ?? '',
      meta_description: settings.meta_description ?? '',
      twitter: settings.social_links?.twitter ?? '',
      facebook: settings.social_links?.facebook ?? '',
      instagram: settings.social_links?.instagram ?? '',
      linkedin: settings.social_links?.linkedin ?? '',
      logo: null as File | null,
      logo_dark: null as File | null,
      favicon: null as File | null,
    })

  const logoInput = useRef<HTMLInputElement>(null)
  const logoDarkInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, type, value, files } = e.target as any
    setData(name, type === 'file' ? files?.[0] ?? null : value)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    post(route('settings.app.update'), { forceFormData: true })
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Paramètres de l'application" />

      <SettingsLayout>
        <div className="space-y-6">
          {/* Identité & marque */}
          <div className="space-y-6">
            <HeadingSmall
              title="Identité & marque"
              description="Gérez l’identité visuelle et les informations publiques de votre espace."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Nom d'application (RO) */}
              <div className="grid gap-2">
                <Label>Nom de l’application (lecture seule)</Label>
                <Input
                  value={settings.app_name ?? 'X-Panel'}
                  readOnly
                  disabled
                  className="opacity-80"
                />
              </div>

              {/* Raison sociale */}
              <div className="grid gap-2">
                <Label htmlFor="company_name">Raison sociale / Nom de l’entreprise</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={data.company_name}
                  onChange={handleChange}
                  placeholder="Global Glimpse SARL, X-Panel SAS, …"
                />
                <InputError className="mt-2" message={errors.company_name} />
              </div>

              {/* Slogan */}
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="app_slogan">Slogan</Label>
                <Input
                  id="app_slogan"
                  name="app_slogan"
                  value={data.app_slogan}
                  onChange={handleChange}
                  placeholder="L’excellence de la gestion…"
                />
                <InputError className="mt-2" message={errors.app_slogan} />
              </div>

              {/* Logo clair */}
              <div className="grid gap-2">
                <Label htmlFor="logo">Logo clair</Label>
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleChange}
                  ref={logoInput}
                />
                <InputError className="mt-2" message={errors.logo} />
                {settings.logo_path && (
                  <img
                    src={settings.logo_path}
                    alt="Logo actuel"
                    className="mt-2 w-28 rounded border"
                  />
                )}
              </div>

              {/* Logo sombre */}
              <div className="grid gap-2">
                <Label htmlFor="logo_dark">Logo sombre</Label>
                <Input
                  id="logo_dark"
                  name="logo_dark"
                  type="file"
                  accept="image/*"
                  onChange={handleChange}
                  ref={logoDarkInput}
                />
                <InputError className="mt-2" message={errors.logo_dark} />
                {settings.logo_dark_path && (
                  <img
                    src={settings.logo_dark_path}
                    alt="Logo sombre"
                    className="mt-2 w-28 rounded border bg-neutral-900"
                  />
                )}
              </div>

              {/* Favicon */}
              <div className="grid gap-2">
                <Label htmlFor="favicon">Favicon</Label>
                <Input
                  id="favicon"
                  name="favicon"
                  type="file"
                  accept="image/png, image/x-icon"
                  onChange={handleChange}
                  ref={faviconInput}
                />
                <InputError className="mt-2" message={errors.favicon} />
                {settings.favicon_url && (
                  <img
                    src={settings.favicon_url}
                    alt="Favicon"
                    className="mt-2 h-10 w-10 rounded border bg-white"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Coordonnées */}
          <div className="space-y-6">
            <HeadingSmall title="Coordonnées de contact" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  value={data.contact_email}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.contact_email} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contact_phone">Téléphone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  value={data.contact_phone}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.contact_phone} />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="contact_address">Adresse</Label>
                <Input
                  id="contact_address"
                  name="contact_address"
                  value={data.contact_address}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.contact_address} />
              </div>
            </div>
          </div>

          {/* Mentions légales */}
          <div className="space-y-6">
            <HeadingSmall title="Mentions légales" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cgu_url">URL des CGU</Label>
                <Input
                  id="cgu_url"
                  name="cgu_url"
                  value={data.cgu_url}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.cgu_url} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="privacy_url">Politique de confidentialité</Label>
                <Input
                  id="privacy_url"
                  name="privacy_url"
                  value={data.privacy_url}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.privacy_url} />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="copyright">Copyright</Label>
                <Input
                  id="copyright"
                  name="copyright"
                  value={data.copyright}
                  onChange={handleChange}
                />
                <InputError className="mt-2" message={errors.copyright} />
              </div>
            </div>
          </div>

          {/* Réseaux sociaux */}
          <div className="space-y-6">
            <HeadingSmall title="Réseaux sociaux" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="twitter">Twitter</Label>
                <Input
                  id="twitter"
                  name="twitter"
                  value={data.twitter}
                  onChange={handleChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  name="facebook"
                  value={data.facebook}
                  onChange={handleChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  name="instagram"
                  value={data.instagram}
                  onChange={handleChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  name="linkedin"
                  value={data.linkedin}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* SEO */}
          <div className="space-y-6">
            <HeadingSmall title="Référencement (SEO)" />

            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="meta_keywords">Mots-clés</Label>
                <Textarea
                  id="meta_keywords"
                  name="meta_keywords"
                  value={data.meta_keywords}
                  onChange={handleChange}
                  rows={2}
                  className={fieldClass}
                />
                <InputError className="mt-2" message={errors.meta_keywords} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="meta_description">Description</Label>
                <Textarea
                  id="meta_description"
                  name="meta_description"
                  value={data.meta_description}
                  onChange={handleChange}
                  rows={3}
                  className={fieldClass}
                />
                <InputError className="mt-2" message={errors.meta_description} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <form onSubmit={submit} className="space-y-6">
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={processing}>
                Enregistrer
              </Button>

              {recentlySuccessful && (
                <span className="text-sm text-neutral-600">
                  Modifications enregistrées
                </span>
              )}
            </div>
          </form>
        </div>
      </SettingsLayout>
    </AppLayout>
  )
}
