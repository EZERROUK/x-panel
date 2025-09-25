import { useEffect, useState } from 'react'
import { useForm, router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import { route } from 'ziggy-js'
import toast from 'react-hot-toast'

type Promotion = {
  id?: number
  name: string
  description?: string
  type: 'order'|'category'|'product'|'bogo'
  apply_scope: 'order'|'category'|'product'
  is_active: boolean
  is_exclusive: boolean
  priority: number
  starts_at?: string|null
  ends_at?: string|null
  action_type?: 'percent'|'fixed'
  value?: number|null
  code?: string
}

export default function PromotionForm({
  initial,
  onSaved,
}: {
  initial?: Partial<Promotion>
  onSaved?: () => void
}) {
  const isEdit = !!initial?.id

  const { data, setData, processing, errors, reset, clearErrors } = useForm<Promotion>({
    id: initial?.id,
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    type: (initial?.type as Promotion['type']) ?? 'order',
    apply_scope: (initial?.apply_scope as Promotion['apply_scope']) ?? 'order',
    is_active: initial?.is_active ?? true,
    is_exclusive: initial?.is_exclusive ?? false,
    priority: initial?.priority ?? 100,
    starts_at: initial?.starts_at ?? '',
    ends_at: initial?.ends_at ?? '',
    action_type: (initial?.action_type as Promotion['action_type']) ?? 'percent',
    value: initial?.value ?? 10,
    code: initial?.code ?? '',
  })

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => () => reset(), [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()

    const payload = {
      name: data.name,
      description: data.description || null,
      type: data.type,
      apply_scope: data.apply_scope,
      is_active: !!data.is_active,
      is_exclusive: !!data.is_exclusive,
      priority: Number(data.priority) || 100,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      actions: [{ action_type: data.action_type!, value: Number(data.value) || 0 }],
      code: (data.code ?? '').trim() || null,
    }

    const opts = {
      preserveScroll: true,
      onSuccess: () => {
        toast.success(isEdit ? 'Promotion mise à jour' : 'Promotion créée')
        onSaved?.()
      },
      onError: () => { toast.error('Erreur lors de l’enregistrement') },
      onFinish: () => setSubmitting(false),
    }

    setSubmitting(true)
    if (isEdit && data.id) {
      router.put(route('admin.promotions.update', data.id), payload, opts)
    } else {
      router.post(route('admin.promotions.store'), payload, opts)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nom *</Label>
          <Input id="name" value={data.name} onChange={(e)=>setData('name', e.target.value)} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label>Priorité</Label>
          <Input
            type="number"
            value={data.priority}
            onChange={(e)=>setData('priority', Number(e.target.value))}
          />
          <p className="text-xs text-slate-500 mt-1">Plus petit = appliqué en premier</p>
        </div>

        <div>
          <Label>Type</Label>
          <Select
            value={data.type}
            onValueChange={(v: 'order'|'category'|'product'|'bogo')=>{
              setData('type', v)
              if (v !== 'order') setData('apply_scope', v as 'category'|'product')
            }}
          >
            <SelectTrigger><SelectValue placeholder="Type"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Commande (ordre complet)</SelectItem>
              <SelectItem value="category" disabled>Catégorie (à venir)</SelectItem>
              <SelectItem value="product" disabled>Produit (à venir)</SelectItem>
              <SelectItem value="bogo" disabled>BOGO (à venir)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Portée d’application</Label>
          <Select
            value={data.apply_scope}
            onValueChange={(v: 'order'|'category'|'product')=>setData('apply_scope', v)}
          >
            <SelectTrigger><SelectValue placeholder="Portée"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="category" disabled>Category</SelectItem>
              <SelectItem value="product" disabled>Product</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea rows={3} value={data.description} onChange={(e)=>setData('description', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Type de remise</Label>
          <Select
            value={data.action_type}
            onValueChange={(v: 'percent'|'fixed')=>setData('action_type', v)}
          >
            <SelectTrigger><SelectValue placeholder="Action"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">% (pourcentage)</SelectItem>
              <SelectItem value="fixed">Montant fixe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valeur</Label>
          <Input
            type="number"
            step="0.01"
            value={data.value ?? 0}
            onChange={(e)=>setData('value', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Code promo (optionnel)</Label>
          <Input value={data.code ?? ''} onChange={(e)=>setData('code', e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">Si renseigné, la promo ne s’applique que via ce code.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Débute le</Label>
          <div className="relative">
            <Input
              type="datetime-local"
              value={data.starts_at ?? ''}
              onChange={(e)=>setData('starts_at', e.target.value)}
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        <div>
          <Label>Se termine le</Label>
          <div className="relative">
            <Input
              type="datetime-local"
              value={data.ends_at ?? ''}
              onChange={(e)=>setData('ends_at', e.target.value)}
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Remplacement du Switch par une checkbox contrôlée */}
      <div className="flex items-center gap-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.is_active}
            onChange={(e)=>setData('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Active</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.is_exclusive}
            onChange={(e)=>setData('is_exclusive', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Exclusive (stoppe les autres)</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={processing || submitting}>
          {isEdit ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
    </form>
  )
}
