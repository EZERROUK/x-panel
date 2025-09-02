import React, { useEffect, useMemo, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import {
  Tag, Hash, ArrowLeft, Plus, Info, ChevronDown, CornerDownRight,
  Image as ImageIcon, Type as TypeIcon, Hash as SlugIcon, ListChecks,
  Trash2, GripVertical, Settings, Eye, EyeOff
} from 'lucide-react';

import AppLayout from '@/layouts/app-layout';
import ParticlesBackground from '@/components/ParticlesBackground';
import { Button } from '@/components/ui/button';

type ParentOption = { id: number; name: string; full_name?: string; level?: number };
type PageProps = {
  parent?: ParentOption | null;
  availableParents: ParentOption[];
  errors: Record<string, string>;
};

type AttributeOption = {
  label: string;
  value: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
};

type ValidationRule = {
  rule: string;
  value?: string | number;
};

type AttrRow = {
  name: string;
  slug: string;
  type: 'text'|'number'|'decimal'|'boolean'|'select'|'multiselect'|'date'|'url'|'email'|'textarea'|'json';
  unit: string;
  is_required: boolean;
  is_filterable: boolean;
  is_searchable: boolean;
  show_in_listing: boolean;
  is_active: boolean;
  sort_order: number;
  description: string;
  default_value: string;
  options: AttributeOption[];
  validation_rules: ValidationRule[];
};

export default function CreateCategory() {
  const page = usePage<PageProps>();
  const parent = page.props.parent ?? null;
  const availableParents = page.props.availableParents ?? [];

  const { data, setData, post, processing, errors, transform, reset } = useForm({
    name: '',
    slug: '',
    parent_id: parent?.id ? String(parent.id) : '',
    icon: '',
    image: null as File | null,
    description: '',
    is_active: true,
    sort_order: 0,
    meta_title: '',
    meta_description: '',
    attributes: [] as AttrRow[],
  });

  const [slugEdited, setSlugEdited] = useState(false);
  const [hasParent, setHasParent] = useState<boolean>(!!parent?.id);
  const [showAttrEditor, setShowAttrEditor] = useState<boolean>(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (data.image instanceof File) {
      const url = URL.createObjectURL(data.image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [data.image]);

  useEffect(() => {
    if (!slugEdited) {
      setData('slug', slugify(data.name));
    }
  }, [data.name]);

  useEffect(() => {
    if (!hasParent) setData('parent_id', '');
  }, [hasParent]);

  const parentOptions = useMemo(() => {
    const base = [{ value: '', label: '— Choisir un parent —' }];
    const opts = availableParents.map((c) => {
      const lvl = Number.isFinite(c.level as number) ? (c.level as number) : 0;
      const indent = '— '.repeat(Math.max(0, lvl));
      return {
        value: String(c.id),
        label: `${indent}${c.name}`,
      };
    });
    return [...base, ...opts];
  }, [availableParents]);

  transform((form) => {
    const attrs = (form.attributes ?? []).map((a: AttrRow, idx: number) => ({
      ...a,
      sort_order: Number.isFinite(a.sort_order) ? a.sort_order : idx,
      // Transformer validation_rules en array pour Laravel
      validation_rules: a.validation_rules.reduce((acc, rule) => {
        if (rule.rule && rule.value !== undefined && rule.value !== '') {
          acc[rule.rule] = rule.value;
        } else if (rule.rule) {
          acc[rule.rule] = true;
        }
        return acc;
      }, {} as Record<string, any>),
    }));

    return {
      ...form,
      parent_id: hasParent ? form.parent_id : '',
      attributes: attrs,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post(route('categories.store'), {
      forceFormData: true,
      onSuccess: () => {
        reset();
        setPreview(null);
      },
    });
  };

  return (
    <>
      <Head title="Créer une catégorie" />

      <div className="relative min-h-screen bg-gradient-to-br
                      from-white via-slate-100 to-slate-200
                      dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]
                      transition-colors duration-500">
        <ParticlesBackground />

        <AppLayout breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard' },
          { title: 'Catégories', href: '/categories' },
          { title: 'Créer', href: '/categories/create' },
        ]}>

          <div className="grid grid-cols-12 gap-6 p-6">
            {/* Form */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-8">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl
                              dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-8">
                <h1 className="text-xl font-semibold mb-6 text-slate-900 dark:text-white">
                  Nouvelle catégorie
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <Field
                    id="name"
                    label="Nom"
                    Icon={Tag}
                    value={data.name}
                    onChange={(v) => {
                      setData('name', v);
                      if (v === '') setSlugEdited(false);
                    }}
                    error={errors.name}
                    required
                  />

                  <Field
                    id="slug"
                    label="Slug (URL)"
                    Icon={SlugIcon}
                    value={data.slug}
                    onChange={(v) => {
                      setData('slug', v);
                      setSlugEdited(true);
                    }}
                    error={errors.slug}
                  />

                  {/* Parent */}
                  <ToggleRow
                    id="has_parent"
                    label="Cette catégorie a un parent"
                    checked={hasParent}
                    onChange={setHasParent}
                  />
                  {hasParent && (
                    <FieldSelect
                      id="parent_id"
                      label="Catégorie parente"
                      value={data.parent_id}
                      onChange={(v) => setData('parent_id', v)}
                      options={parentOptions}
                      error={errors.parent_id}
                      icon={<CornerDownRight className="w-4 h-4" />}
                    />
                  )}

                  <Field
                    id="icon"
                    label="Icône (facultatif)"
                    Icon={TypeIcon}
                    value={data.icon}
                    onChange={(v) => setData('icon', v)}
                    error={errors.icon}
                    required={false}
                  />

                  <FileField
                    id="image"
                    label="Image (facultatif)"
                    Icon={ImageIcon}
                    onChange={(file) => setData('image', file)}
                    previewUrl={preview}
                    error={errors.image}
                  />

                  <Textarea
                    id="description"
                    label="Description"
                    value={data.description}
                    onChange={(v) => setData('description', v)}
                    error={errors.description}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ToggleRow
                      id="is_active"
                      label="Activer la catégorie"
                      checked={!!data.is_active}
                      onChange={(v) => setData('is_active', v)}
                    />
                    <NumberField
                      id="sort_order"
                      label="Ordre d'affichage"
                      value={Number(data.sort_order ?? 0)}
                      onChange={(v) => setData('sort_order', v)}
                      error={errors.sort_order}
                    />
                  </div>

                  {/* SEO */}
                  <Field
                    id="meta_title"
                    label="Meta Title (SEO)"
                    Icon={Tag}
                    value={data.meta_title}
                    onChange={(v) => setData('meta_title', v)}
                    error={errors.meta_title}
                    required={false}
                  />
                  <Textarea
                    id="meta_description"
                    label="Meta Description (SEO)"
                    value={data.meta_description}
                    onChange={(v) => setData('meta_description', v)}
                    error={errors.meta_description}
                  />

                  {/* Editeur d'attributs avancé */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4" />
                        <span className="font-medium">Attributs dynamiques (facultatif)</span>
                      </div>
                      <ToggleRow
                        id="show_attr_editor"
                        label="Activer"
                        checked={showAttrEditor}
                        onChange={setShowAttrEditor}
                      />
                    </div>

                    {showAttrEditor && (
                      <AdvancedAttributesEditor
                        rows={data.attributes}
                        onChange={(rows) => setData('attributes', rows)}
                        errors={errors as any}
                      />
                    )}
                  </div>

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
                                 hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500"
                    >
                      {processing
                        ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />)
                        : (<Plus className="w-4 h-4 mr-2" />)}
                      {processing ? 'Création…' : 'Créer la catégorie'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Aide */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl
                              dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-8">
                <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-white">
                  Guide complet
                </h2>
                <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300">

                  {/* Organisation */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">📁 Organisation</h3>
                    <ul className="space-y-2 pl-4">
                      <li>• <strong>Catégories racines</strong> : grandes familles (ex: Informatique, Mode)</li>
                      <li>• <strong>Sous-catégories</strong> : spécialisations (ex: Ordinateurs → Gaming)</li>
                      <li>• <strong>Slug</strong> : URL unique, lettres/chiffres/tirets uniquement</li>
                    </ul>
                  </div>

                  {/* Attributs */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">🏷️ Attributs dynamiques</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium mb-1">Qu'est-ce que c'est ?</p>
                        <p className="text-xs">Les propriétés que peuvent avoir tes produits (RAM, Couleur, Taille...)</p>
                      </div>

                      <div>
                        <p className="font-medium mb-1">Types d'attributs :</p>
                        <ul className="text-xs space-y-1 pl-3">
                          <li>• <strong>select</strong> : liste déroulante (ex: Couleur → Rouge, Bleu, Vert)</li>
                          <li>• <strong>multiselect</strong> : choix multiples (ex: Compatibilités)</li>
                          <li>• <strong>number</strong> : nombre entier (ex: RAM en GB)</li>
                          <li>• <strong>text</strong> : texte libre (ex: référence modèle)</li>
                          <li>• <strong>boolean</strong> : oui/non (ex: Bluetooth)</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-medium mb-1">Configuration :</p>
                        <ul className="text-xs space-y-1 pl-3">
                          <li>• <strong>Obligatoire</strong> : requis lors création produit</li>
                          <li>• <strong>Filtrable</strong> : apparaît dans filtres recherche</li>
                          <li>• <strong>Recherchable</strong> : inclus dans recherche textuelle</li>
                          <li>• <strong>Listing</strong> : affiché dans liste produits</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Exemples pratiques */}
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="font-semibold text-green-800 dark:text-green-200 mb-3">💡 Exemples pratiques</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="font-medium">Catégorie "PC Gaming" :</p>
                        <ul className="pl-3 space-y-1">
                          <li>• <strong>RAM</strong> (number) : 8, 16, 32, 64 GB</li>
                          <li>• <strong>Processeur</strong> (select) : Intel i5, Intel i7, AMD Ryzen 5...</li>
                          <li>• <strong>RGB</strong> (boolean) : Oui/Non</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium">Catégorie "Smartphones" :</p>
                        <ul className="pl-3 space-y-1">
                          <li>• <strong>Stockage</strong> (select) : 64GB, 128GB, 256GB, 512GB</li>
                          <li>• <strong>Couleur</strong> (select) : Noir, Blanc, Bleu (avec couleurs visuelles)</li>
                          <li>• <strong>5G</strong> (boolean) : Compatible ou non</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Bonnes pratiques */}
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">⚡ Bonnes pratiques</h3>
                    <ul className="text-xs space-y-1 pl-3">
                      <li>• <strong>Commence simple</strong> : 3-5 attributs max au début</li>
                      <li>• <strong>Noms clairs</strong> : "RAM (GB)" plutôt que "Mémoire"</li>
                      <li>• <strong>Unités explicites</strong> : GB, MHz, pouces, cm...</li>
                      <li>• <strong>Validation</strong> : min/max pour éviter erreurs saisie</li>
                      <li>• <strong>Ordre logique</strong> : attributs importants en premier</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </AppLayout>
      </div>
    </>
  );
}

/* ===== Éditeur d'attributs avancé ===== */
function AdvancedAttributesEditor({
  rows, onChange, errors,
}: {
  rows: AttrRow[];
  onChange: (rows: AttrRow[]) => void;
  errors?: Record<string, any>;
}) {
  const addRow = () => {
    onChange([
      ...rows,
      {
        name: '', slug: '', type: 'text', unit: '', is_required: false,
        is_filterable: true, is_searchable: false, show_in_listing: false,
        is_active: true, sort_order: rows.length, description: '', default_value: '',
        options: [], validation_rules: [],
      },
    ]);
  };

  const removeRow = (idx: number) => {
    const next = [...rows];
    next.splice(idx, 1);
    onChange(next.map((r, i) => ({ ...r, sort_order: i })));
  };

  const update = (idx: number, patch: Partial<AttrRow>) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const moveRow = (fromIndex: number, toIndex: number) => {
    const next = [...rows];
    const item = next.splice(fromIndex, 1)[0];
    next.splice(toIndex, 0, item);
    onChange(next.map((r, i) => ({ ...r, sort_order: i })));
  };

  const typeOptions = [
    { value: 'text', label: 'Texte' },
    { value: 'textarea', label: 'Texte long' },
    { value: 'number', label: 'Nombre entier' },
    { value: 'decimal', label: 'Nombre décimal' },
    { value: 'boolean', label: 'Oui/Non' },
    { value: 'select', label: 'Liste déroulante' },
    { value: 'multiselect', label: 'Liste multiple' },
    { value: 'date', label: 'Date' },
    { value: 'url', label: 'URL' },
    { value: 'email', label: 'Email' },
    { value: 'json', label: 'JSON' },
  ];

  return (
    <div className="mt-6 space-y-6">
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun attribut défini. Cliquez sur "Ajouter un attribut" pour commencer.</p>
        </div>
      ) : (
        rows.map((row, idx) => (
          <AttributeEditor
            key={idx}
            index={idx}
            attribute={row}
            onChange={(patch) => update(idx, patch)}
            onRemove={() => removeRow(idx)}
            onMoveUp={idx > 0 ? () => moveRow(idx, idx - 1) : undefined}
            onMoveDown={idx < rows.length - 1 ? () => moveRow(idx, idx + 1) : undefined}
            typeOptions={typeOptions}
            errors={errors?.[`attributes.${idx}`]}
          />
        ))
      )}

      <Button type="button" onClick={addRow} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Ajouter un attribut
      </Button>
    </div>
  );
}

function AttributeEditor({
  index, attribute, onChange, onRemove, onMoveUp, onMoveDown, typeOptions, errors,
}: {
  index: number;
  attribute: AttrRow;
  onChange: (patch: Partial<AttrRow>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  typeOptions: { value: string; label: string }[];
  errors?: Record<string, any>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-génération du slug
  useEffect(() => {
    if (attribute.name && !attribute.slug) {
      onChange({ slug: slugify(attribute.name) });
    }
  }, [attribute.name]);

  const hasOptions = ['select', 'multiselect'].includes(attribute.type);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            {onMoveUp && (
              <button type="button" onClick={onMoveUp} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                <GripVertical className="w-3 h-3 text-slate-400" />
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={onMoveDown} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                <GripVertical className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          <div>
            <h3 className="font-medium text-slate-900 dark:text-white">
              {attribute.name || `Attribut ${index + 1}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {typeOptions.find(t => t.value === attribute.type)?.label || attribute.type}
              {attribute.is_required && ' • Obligatoire'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ is_active: !attribute.is_active })}
            className={`p-1 rounded transition-colors ${
              attribute.is_active
                ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-slate-400 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={attribute.is_active ? 'Actif' : 'Inactif'}
          >
            {attribute.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1 rounded transition-colors ${
              isExpanded
                ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-slate-400 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={isExpanded ? 'Masquer les paramètres' : 'Afficher les paramètres'}
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-4">
        {/* Champs de base */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            id={`attr_name_${index}`}
            label="Nom"
            value={attribute.name}
            onChange={(v) => onChange({ name: v })}
            required
            Icon={Tag}
            error={errors?.name}
          />
          <Field
            id={`attr_slug_${index}`}
            label="Slug"
            value={attribute.slug}
            onChange={(v) => onChange({ slug: v })}
            required
            Icon={Hash}
            error={errors?.slug}
          />
          <FieldSelect
            id={`attr_type_${index}`}
            label="Type"
            value={attribute.type}
            onChange={(v) => onChange({ type: v })}
            options={typeOptions}
            error={errors?.type}
          />
        </div>

        {/* Description et unité */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            id={`attr_desc_${index}`}
            label="Description"
            value={attribute.description}
            onChange={(v) => onChange({ description: v })}
            error={errors?.description}
          />
          <Field
            id={`attr_unit_${index}`}
            label="Unité (ex: GB, MHz)"
            value={attribute.unit}
            onChange={(v) => onChange({ unit: v })}
            required={false}
            error={errors?.unit}
          />
        </div>

        {/* Valeur par défaut */}
        <Field
          id={`attr_default_${index}`}
          label="Valeur par défaut"
          value={attribute.default_value}
          onChange={(v) => onChange({ default_value: v })}
          required={false}
          error={errors?.default_value}
        />

        {/* Options pour select/multiselect */}
        {hasOptions && (
          <OptionsEditor
            options={attribute.options}
            onChange={(options) => onChange({ options })}
            errors={errors?.options}
          />
        )}

        {/* Règles de validation */}
        <ValidationRulesEditor
          rules={attribute.validation_rules}
          type={attribute.type}
          onChange={(validation_rules) => onChange({ validation_rules })}
          errors={errors?.validation_rules}
        />

        {/* Configuration avancée */}
        {isExpanded && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ToggleRow
                id={`attr_req_${index}`}
                label="Obligatoire"
                checked={attribute.is_required}
                onChange={(v) => onChange({ is_required: v })}
              />
              <ToggleRow
                id={`attr_filter_${index}`}
                label="Filtrable"
                checked={attribute.is_filterable}
                onChange={(v) => onChange({ is_filterable: v })}
              />
              <ToggleRow
                id={`attr_search_${index}`}
                label="Recherchable"
                checked={attribute.is_searchable}
                onChange={(v) => onChange({ is_searchable: v })}
              />
              <ToggleRow
                id={`attr_list_${index}`}
                label="Afficher en listing"
                checked={attribute.show_in_listing}
                onChange={(v) => onChange({ show_in_listing: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  options, onChange, errors,
}: {
  options: AttributeOption[];
  onChange: (options: AttributeOption[]) => void;
  errors?: any;
}) {
  const addOption = () => {
    onChange([
      ...options,
      {
        label: '',
        value: '',
        color: '',
        sort_order: options.length,
        is_active: true,
      },
    ]);
  };

  const removeOption = (idx: number) => {
    const next = [...options];
    next.splice(idx, 1);
    onChange(next.map((o, i) => ({ ...o, sort_order: i })));
  };

  const updateOption = (idx: number, patch: Partial<AttributeOption>) => {
    const next = [...options];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Options
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={addOption}>
          <Plus className="w-3 h-3 mr-1" />
          Ajouter
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          Aucune option définie
        </p>
      ) : (
        <div className="space-y-2">
          {options.map((option, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 bg-white dark:bg-slate-900 rounded border">
              <Field
                id={`option_label_${idx}`}
                label={`Label ${idx + 1}`}
                value={option.label}
                onChange={(v) => {
                  updateOption(idx, {
                    label: v,
                    value: v ? slugify(v) : ''
                  });
                }}
                required
                error={errors?.[idx]?.label}
              />
              <Field
                id={`option_value_${idx}`}
                label={`Valeur ${idx + 1}`}
                value={option.value}
                onChange={(v) => updateOption(idx, { value: v })}
                required
                error={errors?.[idx]?.value}
              />
              <div className="flex-shrink-0 pt-6">
                <input
                  type="color"
                  value={option.color || '#6b7280'}
                  onChange={(e) => updateOption(idx, { color: e.target.value })}
                  className="w-8 h-8 rounded border"
                  title="Couleur"
                />
              </div>
              <div className="flex-shrink-0 pt-6">
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationRulesEditor({
  rules, type, onChange, errors,
}: {
  rules: ValidationRule[];
  type: string;
  onChange: (rules: ValidationRule[]) => void;
  errors?: any;
}) {
  const availableRules = useMemo(() => {
    const base = [
      { rule: 'min', label: 'Minimum', hasValue: true },
      { rule: 'max', label: 'Maximum', hasValue: true },
    ];

    switch (type) {
      case 'text':
      case 'textarea':
        return [
          ...base,
          { rule: 'min_length', label: 'Longueur min', hasValue: true },
          { rule: 'max_length', label: 'Longueur max', hasValue: true },
          { rule: 'regex', label: 'Expression régulière', hasValue: true },
        ];
      case 'number':
      case 'decimal':
        return base;
      default:
        return base;
    }
  }, [type]);

  const addRule = (ruleName: string) => {
    if (rules.find(r => r.rule === ruleName)) return;

    onChange([
      ...rules,
      { rule: ruleName, value: '' },
    ]);
  };

  const removeRule = (idx: number) => {
    const next = [...rules];
    next.splice(idx, 1);
    onChange(next);
  };

  const updateRule = (idx: number, patch: Partial<ValidationRule>) => {
    const next = [...rules];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Règles de validation
        </label>
        <div className="relative">
          <select
            onChange={(e) => {
              if (e.target.value) {
                addRule(e.target.value);
                e.target.value = '';
              }
            }}
            className="text-xs border rounded px-2 py-1 bg-white dark:bg-slate-800"
          >
            <option value="">Ajouter une règle</option>
            {availableRules
              .filter(r => !rules.find(existing => existing.rule === r.rule))
              .map(r => (
                <option key={r.rule} value={r.rule}>{r.label}</option>
              ))}
          </select>
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
          Aucune règle définie
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const ruleInfo = availableRules.find(r => r.rule === rule.rule);

            return (
              <div key={idx} className="flex gap-2 items-center p-2 bg-white dark:bg-slate-900 rounded border">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0 flex-shrink-0">
                  {ruleInfo?.label || rule.rule}
                </span>

                {ruleInfo?.hasValue && (
                  <input
                    type="text"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(idx, { value: e.target.value })}
                    placeholder="Valeur"
                    className="flex-1 px-2 py-1 text-sm border rounded bg-transparent"
                  />
                )}

                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===== Composants de base ===== */
interface FieldProps {
  id: string;
  label: string;
  Icon?: any;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  error?: string | false;
}

function Field({
  id, label, Icon, type = 'text', required = true,
  value, onChange, autoComplete, error,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon ? <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /> : null}
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className={`block w-full rounded-lg border py-3 ${Icon ? 'pl-10' : 'pl-3'} pr-3 bg-white dark:bg-slate-800
                      ${error
                        ? 'border-red-500 text-red-500'
                        : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
                      focus:border-red-500 focus:ring-1 focus:ring-red-500`}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function NumberField({
  id, label, value, onChange, error,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void; error?: string | false;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        className={`block w-full rounded-lg border py-3 px-3 bg-white dark:bg-slate-800
          ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
          focus:border-red-500 focus:ring-1 focus:ring-red-500`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function Textarea({
  id, label, value, onChange, error,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string | false;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <textarea
        id={id}
        name={id}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full rounded-lg border py-3 px-3 bg-white dark:bg-slate-800
          ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
          focus:border-red-500 focus:ring-1 focus:ring-red-500`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function FileField({
  id, label, Icon, onChange, previewUrl, error,
}: {
  id: string; label: string; Icon?: any; onChange: (f: File | null) => void; previewUrl: string | null; error?: string | false;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {Icon ? <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /> : null}
        <input
          id={id}
          name={id}
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className={`block w-full rounded-lg border py-3 ${Icon ? 'pl-10' : 'pl-3'} pr-3 bg-white dark:bg-slate-800
            ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
            focus:border-red-500 focus:ring-1 focus:ring-red-500`}
        />
      </div>
      {previewUrl && (
        <div className="mt-3">
          <img src={previewUrl} alt="preview" className="h-24 rounded-md object-cover border border-slate-300 dark:border-slate-700" />
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function FieldSelect({
  id, label, value, onChange, options, error, icon,
}: {
  id: string; label: string; value: string | number;
  onChange: (v: any) => void;
  options: { value: string | number; label: string }[];
  error?: string | false; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {icon ? <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div> : null}
        <select
          id={id}
          name={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full rounded-lg border py-3 ${icon ? 'pl-10' : 'pl-3'} pr-10 bg-white dark:bg-slate-800 appearance-none
            ${error ? 'border-red-500 text-red-500' : 'border-slate-300 text-slate-900 dark:text-white dark:border-slate-700'}
            focus:border-red-500 focus:ring-1 focus:ring-red-500`}
        >
          {options.map(opt => (
            <option key={`${id}-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function ToggleRow({
  id, label, checked, onChange,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
      />
      <label htmlFor={id} className="text-sm text-slate-700 dark:text-slate-300 select-none">
        {label}
      </label>
    </div>
  );
}

function slugify(str: string): string {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
