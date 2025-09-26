<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Client;
use App\Models\Product;
use App\Models\Currency;
use App\Models\TaxRate;
use App\Http\Requests\OrderRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $perPage = $request->input('per_page', 15);
        
        $filters = [
            'search'    => $request->string('search')->toString() ?: null,
            'status'    => $request->string('status')->toString() ?: null,
            'client_id' => $request->string('client_id')->toString() ?: null,
            'start_date' => $request->string('start_date')->toString() ?: null,
            'end_date'   => $request->string('end_date')->toString() ?: null,
        ];

        $query = Order::with(['client', 'user', 'currency', 'quote'])
            ->withCount('items');

        if ($filters['search']) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhereHas('client', function ($clientQuery) use ($search) {
                      $clientQuery->where('company_name', 'like', "%{$search}%");
                  });
            });
        }

        if ($filters['status']) {
            $query->where('status', $filters['status']);
        }
        
        if ($filters['client_id']) {
            $query->where('client_id', $filters['client_id']);
        }
        
        if ($filters['start_date']) {
            $query->whereDate('order_date', '>=', $filters['start_date']);
        }
        
        if ($filters['end_date']) {
            $query->whereDate('order_date', '<=', $filters['end_date']);
        }

        $orders = $query->latest()
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Orders/Index', [
            'orders' => $orders,
            'clients' => Client::active()->orderBy('company_name')->get(['id', 'company_name']),
            'filters' => $filters,
            'statuses' => Order::statuses(),
        ]);
    }

    public function show(Order $order): Response
    {
        $order->load([
            'client',
            'user',
            'currency',
            'quote',
            'items.product'
        ]);

        return Inertia::render('Orders/Show', [
            'order' => $order,
            'statuses' => Order::statuses(),
        ]);
    }

    /**
     * Création manuelle d'une commande
     */
    public function create(): Response
    {
        return Inertia::render('Orders/Create', [
            'clients'    => Client::active()->orderBy('company_name')->get(),
            'products'   => Product::with(['brand','category','currency','taxRate'])
                                   ->where('is_active', true)
                                   ->orderBy('name')
                                   ->get(),
            'currencies' => Currency::all(),
            'taxRates'   => TaxRate::all(),
        ]);
    }

    /**
     * Enregistrement d'une nouvelle commande
     */
    public function store(OrderRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $client = Client::findOrFail($data['client_id']);

        $order = DB::transaction(function () use ($data, $client) {
            $order = Order::create([
                'client_id'        => $data['client_id'],
                'user_id'          => Auth::id(),
                'order_date'       => $data['order_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'currency_code'    => $data['currency_code'],
                'notes'            => $data['notes'] ?? null,
                'internal_notes'   => $data['internal_notes'] ?? null,
                'client_snapshot'  => $client->toSnapshot(),
            ]);

            foreach ($data['items'] as $i => $item) {
                $product = Product::with('taxRate')->findOrFail($item['product_id']);

                $order->items()->create([
                    'product_id'                   => $product->id,
                    'product_name_snapshot'        => $product->name,
                    'product_description_snapshot' => $product->description,
                    'product_sku_snapshot'         => $product->sku,
                    'unit_price_ht_snapshot'       => $item['unit_price_ht'],
                    'tax_rate_snapshot'            => $item['tax_rate'],
                    'quantity'                     => $item['quantity'],
                    'sort_order'                   => $i,
                ]);
            }

            $order->calculateTotals();
            return $order;
        });

        return redirect()
            ->route('orders.show', $order)
            ->with('success', 'Commande créée avec succès.');
    }

    /**
     * Changement de statut avec historique
     */
    public function changeStatus(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'status'  => ['required', 'string', Rule::in(Order::statuses())],
            'comment' => ['nullable', 'string'],
        ]);

        $allowedTransitions = [
            'pending'    => ['confirmed', 'cancelled'],
            'confirmed'  => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped'    => ['delivered'],
            'delivered'  => [],
            'cancelled'  => [],
        ];

        $currentStatus = $order->status;
        $newStatus = $data['status'];

        if (!isset($allowedTransitions[$currentStatus]) || 
            !in_array($newStatus, $allowedTransitions[$currentStatus], true)) {
            return back()->with('error', 'Transition de statut non autorisée.');
        }

        $order->update(['status' => $newStatus]);

        // Mettre à jour les timestamps selon le statut
        match ($newStatus) {
            'confirmed' => $order->update(['confirmed_at' => now()]),
            'shipped'   => $order->update(['shipped_at' => now()]),
            'delivered' => $order->update(['delivered_at' => now()]),
            default     => null,
        };

        return back()->with('success', 'Statut de la commande mis à jour.');
    }

    /**
     * Export PDF d'une commande
     */
    public function exportPdf(Order $order)
    {
        $order->load(['client', 'items.product', 'currency']);
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.order', compact('order'));
        
        return $pdf->stream("Commande_{$order->order_number}.pdf");
    }
}