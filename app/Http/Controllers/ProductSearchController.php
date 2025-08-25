<?php
namespace App\Http\Controllers;


use App\Models\Product;
use Illuminate\Http\Request;


class ProductSearchController extends Controller
{
public function search(Request $request)
{
$q = (string) $request->get('q', '');
$categoryId = $request->get('category_id');
$parentCategoryId = $request->get('parent_category_id');


$query = Product::query()
->select(['id','name','sku','category_id'])
->when($q, fn($qq)=>$qq->where(fn($w)=>
$w->where('name','like',"%{$q}%")
->orWhere('sku','like',"%{$q}%")
))
->when($categoryId, fn($qq)=>$qq->where('category_id', $categoryId))
->when($parentCategoryId, function ($qq) use ($parentCategoryId) {
$qq->whereHas('category', fn($c)=>$c->where('parent_id', $parentCategoryId));
})
->limit(20);


return response()->json($query->get());
}
}
