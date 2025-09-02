<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class AppSetting extends Model
{
    protected $fillable = [
        'company_name',
        'app_slogan',
        'logo_path',
        'logo_dark_path',
        'favicon_path',
        'contact_email',
        'contact_phone',
        'contact_address',
        'cgu_url',
        'privacy_url',
        'copyright',
        'social_links',
        'meta_keywords',
        'meta_description',
        'is_configured',
        'onboarding_completed_at',
    ];

    protected $casts = [
        'social_links' => 'array',
        'is_configured' => 'boolean',
        'onboarding_completed_at' => 'datetime',
    ];

    protected $appends = [
        'logo_url', 'logo_dark_url', 'favicon_url',
    ];

    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo_path ? Storage::url($this->logo_path) : null;
    }

    public function getLogoDarkUrlAttribute(): ?string
    {
        return $this->logo_dark_path ? Storage::url($this->logo_dark_path) : null;
    }

    public function getFaviconUrlAttribute(): ?string
    {
        return $this->favicon_path ? Storage::url($this->favicon_path) : null;
    }
}
