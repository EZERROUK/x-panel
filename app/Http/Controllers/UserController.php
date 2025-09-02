<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;
use App\Exports\UsersExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(Request $request)
{
    /** @var \App\Models\User $auth */
    $auth = Auth::user();

    // Base + relations
    $query = User::with('roles');

    // 👉 Flag virtuel is_super_admin + tri SuperAdmin d'abord
    $query = $query->withExists([
        'roles as is_super_admin' => fn($q) => $q->where('name', 'SuperAdmin'),
    ])->orderByDesc('is_super_admin');

    // Filtres côté serveur
    if ($request->filled('search')) {
        $search = $request->string('search');
        $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
              ->orWhere('email', 'like', "%{$search}%");
        });
    }

    if ($request->filled('name')) {
        $query->where('name', 'like', '%' . $request->name . '%');
    }

    if ($request->filled('email')) {
        $query->where('email', 'like', '%' . $request->email . '%');
    }

    if ($request->filled('role')) {
        $role = $request->string('role');
        $query->whereHas('roles', fn($rq) => $rq->where('name', $role));
    }

    if ($request->filled('status')) {
        $status = strtolower($request->string('status'));
        if ($status === 'actif') {
            $query->whereNull('deleted_at');
        } elseif ($status === 'désactivé') {
            $query->whereNotNull('deleted_at');
        }
    }

    // Les SuperAdmin voient aussi les soft-deleted
    if ($auth && $auth->hasRole('SuperAdmin')) {
        $query->withTrashed();
    }

    // 👉 Tri secondaire par nom (après SuperAdmin d'abord)
    $query->orderBy('name');

    // Exécution
    $users = $query->get();

    // Liste des rôles pour les filtres/affichage
    $roles = \Spatie\Permission\Models\Role::pluck('name')->toArray();

    return Inertia::render('Users/Index', [
        'users'   => $users,
        'roles'   => $roles,
        'filters' => $request->only(['search', 'name', 'email', 'role', 'status', 'per_page']),
    ]);
}


    public function export()
    {
        return Excel::download(new UsersExport, 'utilisateurs.xlsx');
    }

    public function create()
    {
        $user = Auth::user();

        $roles = Role::query();

        if (!$user->hasRole('SuperAdmin')) {
            $roles = $roles->where('name', '!=', 'SuperAdmin');
        }

        return Inertia::render('Users/Create', [
            'roles' => $roles->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:10|confirmed|regex:/[a-z]/|regex:/[A-Z]/|regex:/[0-9]/',
            'role' => 'required|string|exists:roles,name'
        ]);

        /** @var \App\Models\User $actor */
        $actor = Auth::user();
        if ($validated['role'] === 'SuperAdmin' && !$actor->hasRole('SuperAdmin')) {
            abort(403, 'Seul un SuperAdmin peut créer un SuperAdmin.');
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        $user->assignRole($validated['role']);

        return redirect()->route('users.index')->with('success', 'Utilisateur créé avec succès.');
    }

    public function show($id)
    {
        $user = User::findOrFail($id);
        $userRoles = $user->roles()->pluck('name');

        return Inertia::render('Users/Show', [
            'user' => $user,
            'userRoles' => $userRoles,
        ]);
    }

    public function edit(User $user)
    {
        $this->ensureCanManage($user);

        /** @var \App\Models\User $authUser */
        $authUser = Auth::user();
        $roles = Role::query();

        if (!$authUser->hasRole('SuperAdmin')) {
            $roles = $roles->where('name', '!=', 'SuperAdmin');
        }

        return Inertia::render('Users/Edit', [
            'user' => $user,
            'roles' => $roles->get(),
            'userRoles' => $user->roles->pluck('name')->toArray(),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $this->ensureCanManage($user);

        /** @var \App\Models\User $actor */
        $actor = Auth::user();

        $validated = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:10|confirmed|regex:/[a-z]/|regex:/[A-Z]/|regex:/[0-9]/',
            'roles' => 'required|array',
        ]);

        if (!$actor->hasRole('SuperAdmin') && in_array('SuperAdmin', $validated['roles'], true)) {
            abort(403, 'Seul un SuperAdmin peut attribuer le rôle SuperAdmin.');
        }

        $isRemovingSuperAdmin = $user->hasRole('SuperAdmin') && !in_array('SuperAdmin', $validated['roles'], true);
        if ($isRemovingSuperAdmin) {
            $this->ensureNotLastSuperAdmin($user, true);
        }

        $previousRoles = $user->roles->pluck('name')->toArray();

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'] ? bcrypt($validated['password']) : $user->password,
        ]);

        if (!empty($validated['password'])) {
            activity('user')
                ->performedOn($user)
                ->causedBy($actor)
                ->withProperties([
                    'Utilisateur' => $user->name,
                    'info' => 'Mot de passe modifié',
                ])
                ->log('Changement de mot de passe');
        }

        $user->syncRoles($validated['roles']);

        $newRoles = $user->roles->pluck('name')->toArray();
        $rolesChanged = count(array_diff($previousRoles, $newRoles)) > 0 || count(array_diff($newRoles, $previousRoles)) > 0;

        if ($rolesChanged) {
            $addedRoles = array_diff($newRoles, $previousRoles);
            $removedRoles = array_diff($previousRoles, $newRoles);

            activity('user')
                ->performedOn($user)
                ->causedBy($actor)
                ->withProperties([
                    'Utilisateur' => $user->name,
                    'info' => 'Rôles modifiés',
                    'roles_précédents' => $previousRoles,
                    'nouveaux_roles' => $newRoles,
                    'roles_ajoutés' => $addedRoles,
                    'roles_supprimés' => $removedRoles,
                ])
                ->log('Modification des rôles');
        }

        return redirect()->route('users.index')->with('message', 'Utilisateur mis à jour avec succès.');
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $this->ensureCanManage($user);
        $this->ensureNotLastSuperAdmin($user, true);

        $user->delete();
        return redirect()->route('users.index')->with('success', 'Utilisateur supprimé avec succès.');
    }

    public function restore($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $this->ensureCanManage($user);

        $user->restore();
        return redirect()->back()->with('success', 'Utilisateur restauré avec succès.');
    }

    public function forceDelete($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $this->ensureCanManage($user);
        $this->ensureNotLastSuperAdmin($user, true);

        $user->forceDelete();
        return redirect()->route('users.index')->with('success', 'Utilisateur supprimé définitivement.');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers de sécurité
    // ─────────────────────────────────────────────────────────────────────
    private function ensureCanManage(User $target): void
    {
        /** @var \App\Models\User $actor */
        $actor = Auth::user();
        if ($target->hasRole('SuperAdmin') && !$actor->hasRole('SuperAdmin')) {
            throw new AuthorizationException('Action non autorisée (cible SuperAdmin).');
        }
    }

    private function ensureNotLastSuperAdmin(User $target, bool $isRoleRemoval = false): void
    {
        if (!$target->hasRole('SuperAdmin')) return;

        $count = Role::findByName('SuperAdmin')->users()->count();
        if ($count <= 1 && $isRoleRemoval) {
            throw new AuthorizationException("Impossible : c’est le dernier SuperAdmin.");
        }
    }
}
