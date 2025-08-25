<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CategoryController;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Attributs d’une catégorie (méthode identique)
Route::get('/categories/{category}/attributes', [CategoryController::class, 'apiAttributes'])
    ->name('api.categories.attributes');
