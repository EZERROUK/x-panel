<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class SetupController extends Controller
{
    /** Affiche l’assistant tant que l’app n’est pas configurée */
    public function show()
    {
        $settings = AppSetting::first();

        if ($settings && $settings->is_configured) {
            return redirect()->route('login');
        }

        return Inertia::render('Setup/Index', [
            'settings' => $settings,
        ]);
    }

    /** Enregistre la configuration initiale */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'company_name'      => ['required', 'string', 'max:150'],
            'app_slogan'        => ['nullable', 'string', 'max:150'],

            'contact_email'     => ['nullable', 'email', 'max:150'],
            'contact_phone'     => ['nullable', 'string', 'max:50'],
            'contact_address'   => ['nullable', 'string', 'max:255'],

            'cgu_url'           => ['nullable', 'url', 'max:255'],
            'privacy_url'       => ['nullable', 'url', 'max:255'],
            'copyright'         => ['nullable', 'string', 'max:255'],

            'meta_keywords'     => ['nullable', 'string', 'max:1000'],
            'meta_description'  => ['nullable', 'string', 'max:1000'],

            // sociaux : on accepte URL ou handle -> on normalise ensuite
            'twitter'           => ['nullable', 'string', 'max:255'],
            'facebook'          => ['nullable', 'string', 'max:255'],
            'instagram'         => ['nullable', 'string', 'max:255'],
            'linkedin'          => ['nullable', 'string', 'max:255'],

            // fichiers
            'logo'              => ['nullable', 'image', 'max:2048'],
            'logo_dark'         => ['nullable', 'image', 'max:2048'],
            'favicon'           => ['nullable', 'mimes:png,ico', 'max:512'],
        ]);

        // Trim doux
        foreach ($validated as $k => $v) {
            if (is_string($v)) {
                $validated[$k] = trim($v);
            }
        }

        // Nettoyage téléphone (on enlève juste les espaces, on garde le +)
        if (!empty($validated['contact_phone'])) {
            $validated['contact_phone'] = preg_replace('/\s+/', '', $validated['contact_phone']);
        }

        // Normalisation des réseaux sociaux en URLs complètes
        $social = [
            'twitter'   => $this->socialToUrl($validated['twitter']   ?? null, 'twitter'),
            'facebook'  => $this->socialToUrl($validated['facebook']  ?? null, 'facebook'),
            'instagram' => $this->socialToUrl($validated['instagram'] ?? null, 'instagram'),
            'linkedin'  => $this->socialToUrl($validated['linkedin']  ?? null, 'linkedin'),
        ];

        // Récupération (ou création) de l’unique ligne de settings
        $settings = AppSetting::firstOrNew([]);

        // Champs simples
        $settings->company_name       = $validated['company_name'];
        $settings->app_slogan         = $validated['app_slogan']        ?? null;

        $settings->contact_email      = $validated['contact_email']      ?? null;
        $settings->contact_phone      = $validated['contact_phone']      ?? null;
        $settings->contact_address    = $validated['contact_address']    ?? null;

        $settings->cgu_url            = $validated['cgu_url']            ?? null;
        $settings->privacy_url        = $validated['privacy_url']        ?? null;
        $settings->copyright          = $validated['copyright']          ?? null;

        $settings->meta_keywords      = $validated['meta_keywords']      ?? null;
        $settings->meta_description   = $validated['meta_description']   ?? null;

        // Social links en JSON
        $settings->social_links = $social;

        // Uploads : si un nouveau fichier est fourni, on supprime l’ancien
        if ($request->hasFile('logo')) {
            if ($settings->logo_path) {
                Storage::disk('public')->delete($settings->logo_path);
            }
            $settings->logo_path = $request->file('logo')->store('logos', 'public');
        }

        if ($request->hasFile('logo_dark')) {
            if ($settings->logo_dark_path) {
                Storage::disk('public')->delete($settings->logo_dark_path);
            }
            $settings->logo_dark_path = $request->file('logo_dark')->store('logos', 'public');
        }

        if ($request->hasFile('favicon')) {
            if ($settings->favicon_path) {
                Storage::disk('public')->delete($settings->favicon_path);
            }
            $settings->favicon_path = $request->file('favicon')->store('favicons', 'public');
        }

        // Marquer comme configurée
        if (!$settings->is_configured) {
            $settings->is_configured = true;
            $settings->onboarding_completed_at = now();
        }

        $settings->save();

        return redirect()
            ->route('login')
            ->with('success', 'Configuration terminée. Vous pouvez vous connecter.');
    }

    /**
     * Transforme un handle ou une chaîne partielle en URL complète selon la plateforme.
     * - "@moncompte" -> "https://twitter.com/moncompte"
     * - "moncompte"  -> idem
     * - "https://..." -> renvoyé tel quel
     */
    private function socialToUrl(?string $value, string $platform): ?string
    {
        if (!$value) return null;

        $v = trim($value);

        // Si déjà une URL complète, on renvoie tel quel
        if (preg_match('/^https?:\/\//i', $v)) {
            return $v;
        }

        // Supprime un éventuel @ en tête
        $v = ltrim($v, '@');

        switch ($platform) {
            case 'twitter':
                return "https://twitter.com/{$v}";
            case 'instagram':
                return "https://www.instagram.com/{$v}";
            case 'facebook':
                // Si l’utilisateur a mis par ex "groups/xxxx" on le garde
                return "https://www.facebook.com/{$v}";
            case 'linkedin':
                // Si l’utilisateur met "in/xxxxx" ou "company/xxxxx", on garde
                if (str_starts_with($v, 'in/') || str_starts_with($v, 'company/')) {
                    return "https://www.linkedin.com/{$v}";
                }
                // Par défaut on suppose une page entreprise
                return "https://www.linkedin.com/company/{$v}";
            default:
                return $value;
        }
    }
}
