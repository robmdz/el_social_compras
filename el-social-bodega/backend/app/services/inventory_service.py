"""Inventory service — products, stock, movements, price history, supplier links."""

from datetime import datetime, timezone
from typing import Optional, List, Any
from app.db.client import get_supabase_admin
from app.models.inventory import MovementType


def _get_next_product_code() -> str:
    """Generate the next sequential internal product code: INS-0001, INS-0002, ..."""
    client = get_supabase_admin()
    response = (
        client.table("products")
        .select("code")
        .ilike("code", "INS-%")
        .order("code", desc=True)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return "INS-0001"

    latest_code = (rows[0].get("code") or "").strip().upper()
    if not latest_code.startswith("INS-"):
        return "INS-0001"

    try:
        current_number = int(latest_code.replace("INS-", ""))
    except ValueError:
        return "INS-0001"

    return f"INS-{current_number + 1:04d}"



def get_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    include_pending: bool = False,
) -> List[dict[str, Any]]:
    """Select from products left-joining inventory_stock to include current_quantity.
    Apply ilike on name/code if search provided, exact match on category.
    """
    client = get_supabase_admin()
    query = client.table("products").select("*, inventory_stock(current_quantity, counted_at)")

    if search:
        query = query.or_(f"name.ilike.%{search}%,code.ilike.%{search}%")
    if category:
        query = query.eq("category", category)
    if not include_pending:
        query = query.eq("is_pending", False)

    response = query.execute()
    rows = response.data or []

    # Flatten inventory_stock if it comes as a list (one-to-one)
    for row in rows:
        inv = row.get("inventory_stock")
        if isinstance(inv, list) and inv:
            row["current_quantity"] = inv[0].get("current_quantity", 0)
            row["quantity_counted_at"] = inv[0].get("counted_at")
        elif isinstance(inv, dict):
            row["current_quantity"] = inv.get("current_quantity", 0)
            row["quantity_counted_at"] = inv.get("counted_at")
        else:
            row["current_quantity"] = 0
            row["quantity_counted_at"] = None
        if "inventory_stock" in row:
            del row["inventory_stock"]

    return rows


def get_product(product_id: int) -> dict[str, Any]:
    """Get single product with current_quantity from inventory_stock."""
    client = get_supabase_admin()
    response = (
        client.table("products")
        .select("*, inventory_stock(current_quantity, counted_at)")
        .eq("id", product_id)
        .execute()
    )

    if not response.data or len(response.data) == 0:
        raise ValueError(f"Product with id {product_id} not found")

    row = response.data[0]
    inv = row.get("inventory_stock")
    if isinstance(inv, list) and inv:
        row["current_quantity"] = inv[0].get("current_quantity", 0)
        row["quantity_counted_at"] = inv[0].get("counted_at")
    elif isinstance(inv, dict):
        row["current_quantity"] = inv.get("current_quantity", 0)
        row["quantity_counted_at"] = inv.get("counted_at")
    else:
        row["current_quantity"] = 0
        row["quantity_counted_at"] = None
    if "inventory_stock" in row:
        del row["inventory_stock"]

    return row


def _extract_api_error_message(exc: Exception) -> str:
    """Extract a readable message from Supabase/PostgREST API errors."""
    msg = str(exc)
    if hasattr(exc, "message") and exc.message:
        msg = exc.message
    if hasattr(exc, "details") and exc.details:
        msg = f"{msg}: {exc.details}"
    return msg or "Error de base de datos"


def create_product(data: dict[str, Any]) -> dict[str, Any]:
    """Insert into products, also create inventory_stock row with quantity 0. Return product."""
    client = get_supabase_admin()
    initial_quantity = int(data.get("initial_quantity", 0) or 0)
    initial_stock_location = data.get("initial_stock_location", "all_sedes")
    initial_sede_id = data.get("initial_sede_id")

    if initial_quantity < 0:
        raise ValueError("Initial quantity must be non-negative")
    if initial_stock_location not in {"bodega", "all_sedes", "single_sede"}:
        raise ValueError("initial_stock_location must be 'bodega', 'all_sedes', or 'single_sede'")
    if initial_stock_location == "single_sede" and not initial_sede_id:
        raise ValueError("initial_sede_id is required when initial_stock_location is 'single_sede'")

    allowed_product_keys = {"name", "category", "unit", "min_stock", "code", "is_pending", "created_by"}
    product_data = {k: v for k, v in data.items() if k in allowed_product_keys}
    product_data["name"] = (data.get("name") or "").strip()
    product_data["category"] = (data.get("category") or "").strip()
    product_data["unit"] = (data.get("unit") or "").strip()
    product_data["min_stock"] = int(data.get("min_stock", 0) or 0)
    product_data["code"] = _get_next_product_code()
    product_data.setdefault("is_pending", False)
    if data.get("created_by") is not None:
        product_data["created_by"] = data["created_by"]

    try:
        response = client.table("products").insert(product_data).execute()
    except Exception as e:
        raise ValueError(_extract_api_error_message(e)) from e

    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to create product")

    product = response.data[0]
    product_id = product["id"]

    bodega_quantity = initial_quantity if initial_stock_location == "bodega" else 0
    try:
        client.table("inventory_stock").insert(
            {"product_id": product_id, "current_quantity": bodega_quantity}
        ).execute()
    except Exception as e:
        raise ValueError(f"Error al crear stock en bodega: {_extract_api_error_message(e)}") from e

    try:
        if initial_stock_location == "all_sedes":
            sedes_response = client.table("sedes").select("id").execute()
            sedes = sedes_response.data or []
            if sedes:
                stock_rows = [
                    {
                        "sede_id": sede["id"],
                        "product_id": product_id,
                        "current_quantity": initial_quantity,
                    }
                    for sede in sedes
                ]
                client.table("inventory_stock_sede").upsert(
                    stock_rows,
                    on_conflict="sede_id,product_id",
                ).execute()
        elif initial_stock_location == "single_sede":
            client.table("inventory_stock_sede").upsert(
                {
                    "sede_id": int(initial_sede_id),
                    "product_id": product_id,
                    "current_quantity": initial_quantity,
                },
                on_conflict="sede_id,product_id",
            ).execute()
    except Exception as e:
        raise ValueError(f"Error al asignar stock por sede: {_extract_api_error_message(e)}") from e

    product["current_quantity"] = bodega_quantity
    return product


def approve_product(product_id: int) -> dict[str, Any]:
    """Mark a pending product as approved."""
    client = get_supabase_admin()
    response = (
        client.table("products")
        .update({"is_pending": False})
        .eq("id", product_id)
        .execute()
    )
    if not response.data or len(response.data) == 0:
        raise ValueError(f"Product with id {product_id} not found")
    return get_product(product_id)


def update_product(product_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Update product fields. Supports setting nullable fields to None."""
    client = get_supabase_admin()
    # Only strip internal-only field; keep explicit None values so callers
    # can intentionally clear nullable columns via PATCH.
    filtered = {k: v for k, v in data.items() if k != "current_quantity"}

    if not filtered:
        return get_product(product_id)

    response = client.table("products").update(filtered).eq("id", product_id).execute()

    if not response.data or len(response.data) == 0:
        raise ValueError(f"Product with id {product_id} not found")

    return get_product(product_id)


def delete_product(product_id: int) -> None:
    """Delete product and related records."""
    client = get_supabase_admin()

    # Confirm product exists before cascading deletes (avoids silent no-op)
    exists = client.table("products").select("id").eq("id", product_id).limit(1).execute()
    if not exists.data:
        raise ValueError(f"Product with id {product_id} not found")

    # Delete related records first (order of FK dependencies)
    client.table("order_items").delete().eq("product_id", product_id).execute()
    client.table("inventory_movements").delete().eq("product_id", product_id).execute()
    client.table("price_history").delete().eq("product_id", product_id).execute()
    client.table("product_suppliers").delete().eq("product_id", product_id).execute()
    client.table("inventory_stock").delete().eq("product_id", product_id).execute()
    client.table("products").delete().eq("id", product_id).execute()


def link_supplier(product_id: int, supplier_id: int, slot: int) -> dict[str, Any]:
    """Upsert into product_suppliers table."""
    client = get_supabase_admin()
    data = {"product_id": product_id, "supplier_id": supplier_id, "slot": slot}
    response = (
        client.table("product_suppliers")
        .upsert(data, on_conflict="product_id,slot")
        .execute()
    )
    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to link supplier")
    return response.data[0]


def unlink_supplier(product_id: int, slot: int) -> None:
    """Delete from product_suppliers by product_id and slot."""
    client = get_supabase_admin()
    client.table("product_suppliers").delete().eq("product_id", product_id).eq(
        "slot", slot
    ).execute()


def add_price(
    product_id: int,
    supplier_id: int,
    price: float,
    recorded_month: int,
    recorded_year: int,
) -> dict[str, Any]:
    """Insert into price_history (append-only)."""
    client = get_supabase_admin()
    data = {
        "product_id": product_id,
        "supplier_id": supplier_id,
        "price": price,
        "recorded_month": recorded_month,
        "recorded_year": recorded_year,
    }
    response = client.table("price_history").insert(data).execute()
    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to add price")
    return response.data[0]


def get_price_history(product_id: int, months: int = 12) -> List[dict[str, Any]]:
    """Select from price_history for product, ordered by year desc, month desc, limited."""
    client = get_supabase_admin()
    response = (
        client.table("price_history")
        .select("*")
        .eq("product_id", product_id)
        .order("recorded_year", desc=True)
        .order("recorded_month", desc=True)
        .limit(months)
        .execute()
    )
    return response.data or []


def get_price_comparison(product_id: int) -> List[dict[str, Any]]:
    """For each linked supplier, get latest price from price_history, compute variation
    vs previous month, flag the lowest as is_best_price.
    Uses 2 batch queries instead of N+1 per supplier (Issue #5).
    """
    client = get_supabase_admin()
    links = (
        client.table("product_suppliers")
        .select("supplier_id, slot")
        .eq("product_id", product_id)
        .execute()
    ).data or []

    if not links:
        return []

    supplier_ids = [lnk["supplier_id"] for lnk in links]
    slot_by_sid = {lnk["supplier_id"]: lnk["slot"] for lnk in links}

    # Batch-fetch supplier names in one query
    suppliers_resp = (
        client.table("suppliers")
        .select("id, company_name")
        .in_("id", supplier_ids)
        .execute()
    ).data or []
    name_by_sid: dict[int, str] = {s["id"]: s["company_name"] for s in suppliers_resp}

    # Batch-fetch last 2 price records per supplier (ordered newest-first)
    # We limit to 2 * len(supplier_ids) and group in Python to get
    # current + previous price per supplier without N separate queries.
    hist_resp = (
        client.table("price_history")
        .select("supplier_id, price, recorded_year, recorded_month")
        .eq("product_id", product_id)
        .in_("supplier_id", supplier_ids)
        .order("recorded_year", desc=True)
        .order("recorded_month", desc=True)
        .execute()
    ).data or []

    # Group history rows by supplier — take first two per supplier (newest first)
    hist_by_sid: dict[int, list] = {}
    for row in hist_resp:
        sid = row["supplier_id"]
        if sid not in hist_by_sid:
            hist_by_sid[sid] = []
        if len(hist_by_sid[sid]) < 2:
            hist_by_sid[sid].append(row)

    results = []
    for sid in supplier_ids:
        slot = slot_by_sid[sid]
        hist = hist_by_sid.get(sid, [])
        current_price = hist[0]["price"] if hist else None
        previous_price = hist[1]["price"] if len(hist) > 1 else None
        supplier_name = name_by_sid.get(sid, "")

        variation_pct = None
        if current_price is not None and previous_price is not None and previous_price > 0:
            variation_pct = ((current_price - previous_price) / previous_price) * 100

        results.append(
            {
                "supplier_id": sid,
                "supplier_name": supplier_name,
                "slot": slot,
                "current_price": current_price,
                "previous_price": previous_price,
                "variation_pct": variation_pct,
                "is_best_price": False,
            }
        )

    # Flag the lowest current price
    valid = [r for r in results if r["current_price"] is not None]
    if valid:
        min_price = min(r["current_price"] for r in valid)
        for r in results:
            r["is_best_price"] = r["current_price"] == min_price

    return results


def create_movement(data: dict[str, Any], user_id: str) -> dict[str, Any]:
    """Insert into inventory_movements, then atomically update inventory_stock
    via Postgres RPC (decrement_stock / increment_stock) to prevent race conditions.
    If a decrement would make stock negative, the DB raises and we surface a 400.
    """
    client = get_supabase_admin()
    movement_type = data.get("movement_type")
    quantity = data.get("quantity", 0)
    product_id = data.get("product_id")

    if quantity <= 0:
        raise ValueError("Quantity must be positive")

    # Determine direction using enum values for type safety (Issue #16)
    exit_types = {MovementType.exit_by_request.value, MovementType.loss_damage.value}
    is_exit = movement_type in exit_types

    movement_data = {
        "product_id": product_id,
        "movement_type": movement_type,
        "quantity": quantity,
        "user_id": user_id,
        "sede_id": data.get("sede_id"),
        "notes": data.get("notes"),
    }
    mov_resp = client.table("inventory_movements").insert(movement_data).execute()
    if not mov_resp.data or len(mov_resp.data) == 0:
        raise ValueError("Failed to create movement")

    # Atomic stock update via Postgres function (Issue #3)
    # For exits: decrement_stock raises if stock is insufficient.
    # For entries: increment_stock uses INSERT … ON CONFLICT DO UPDATE.
    rpc_name = "decrement_stock" if is_exit else "increment_stock"
    try:
        client.rpc(rpc_name, {"p_id": product_id, "amount": quantity}).execute()
    except Exception as e:
        err_msg = str(e)
        if "insufficient_stock" in err_msg:
            raise ValueError(
                f"Insufficient stock for product {product_id}: requested {quantity}"
            ) from e
        raise ValueError(f"Failed to update stock: {err_msg}") from e

    return mov_resp.data[0]


def get_movements(
    product_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[dict[str, Any]]:
    """Select from inventory_movements with optional filters."""
    client = get_supabase_admin()
    query = client.table("inventory_movements").select("*")

    if product_id is not None:
        query = query.eq("product_id", product_id)
    if movement_type:
        query = query.eq("movement_type", movement_type)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    response = query.order("created_at", desc=True).execute()
    return response.data or []


def get_low_stock_alerts() -> List[dict[str, Any]]:
    """Select products where inventory_stock.current_quantity < products.min_stock.
    Return list with product info and deficit.
    """
    client = get_supabase_admin()
    response = (
        client.table("products")
        .select("id, name, code, min_stock, inventory_stock(current_quantity)")
        .execute()
    )

    alerts = []
    for row in response.data or []:
        inv = row.get("inventory_stock")
        current = 0
        if isinstance(inv, list) and inv:
            current = inv[0].get("current_quantity", 0)
        elif isinstance(inv, dict):
            current = inv.get("current_quantity", 0)

        min_stock = row.get("min_stock", 0)
        if current < min_stock:
            alerts.append(
                {
                    "product_id": row["id"],
                    "product_name": row["name"],
                    "product_code": row["code"],
                    "current_quantity": current,
                    "min_stock": min_stock,
                    "deficit": min_stock - current,
                }
            )

    return alerts


def get_sede_stock(sede_id: int) -> List[dict[str, Any]]:
    """Return all products with their current quantity at the given sede.
    Products without a row in inventory_stock_sede have quantity 0.
    """
    client = get_supabase_admin()
    response = (
        client.table("inventory_stock_sede")
        .select("product_id, current_quantity, counted_at")
        .eq("sede_id", sede_id)
        .execute()
    )
    by_product: dict[int, dict] = {
        r["product_id"]: {"quantity": r["current_quantity"], "counted_at": r.get("counted_at")}
        for r in (response.data or [])
    }

    products = get_products(include_pending=False)
    out = []
    for p in products:
        info = by_product.get(p["id"], {"quantity": 0, "counted_at": None})
        qty = info["quantity"] if isinstance(info, dict) else info
        counted_at = info.get("counted_at") if isinstance(info, dict) else None
        out.append({
            "product_id": p["id"],
            "code": p.get("code"),
            "name": p["name"],
            "category": p.get("category", ""),
            "unit": p.get("unit", ""),
            "quantity": qty,
            "quantity_counted_at": counted_at,
        })
    return out


def upsert_sede_stock(sede_id: int, product_id: int, quantity: int) -> dict[str, Any]:
    """Set (upsert) stock for a product at a sede. Only non-negative quantity.
    Sets counted_at to now so we know since when this amount is accounted for.
    Returns the updated row (sede_id, product_id, current_quantity, counted_at).
    """
    if quantity < 0:
        raise ValueError("Quantity must be non-negative")
    client = get_supabase_admin()
    payload = {
        "sede_id": sede_id,
        "product_id": product_id,
        "current_quantity": quantity,
        "counted_at": datetime.now(timezone.utc).isoformat(),
    }
    response = client.table("inventory_stock_sede").upsert(
        payload,
        on_conflict="sede_id,product_id",
    ).execute()
    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to upsert sede stock")
    return response.data[0]


def _get_sede_product_quantity(sede_id: int, product_id: int) -> int:
    """Return current quantity for a product at a sede, or 0 if no row."""
    client = get_supabase_admin()
    response = (
        client.table("inventory_stock_sede")
        .select("current_quantity")
        .eq("sede_id", sede_id)
        .eq("product_id", product_id)
        .execute()
    )
    if not response.data or len(response.data) == 0:
        return 0
    return response.data[0].get("current_quantity", 0)


def transfer_bodega_to_sede(
    product_id: int, sede_id: int, quantity: int, user_id: str
) -> dict[str, Any]:
    """Move quantity from bodega (inventory_stock) to sede (inventory_stock_sede).
    Records movement with type transfer_bodega_to_sede.
    """
    if quantity <= 0:
        raise ValueError("Quantity must be positive")
    client = get_supabase_admin()
    # 1. Decrement bodega stock (raises if insufficient)
    try:
        client.rpc("decrement_stock", {"p_id": product_id, "amount": quantity}).execute()
    except Exception as e:
        err_msg = str(e)
        if "insufficient_stock" in err_msg:
            raise ValueError(
                f"Insufficient stock in bodega for product {product_id}: requested {quantity}"
            ) from e
        raise ValueError(f"Failed to update bodega stock: {err_msg}") from e
    # 2. Add to sede stock
    current_sede = _get_sede_product_quantity(sede_id, product_id)
    upsert_sede_stock(sede_id, product_id, current_sede + quantity)
    # 3. Record movement
    movement_data = {
        "product_id": product_id,
        "movement_type": "transfer_bodega_to_sede",
        "quantity": quantity,
        "user_id": user_id,
        "sede_id": sede_id,
    }
    mov_resp = client.table("inventory_movements").insert(movement_data).execute()
    if not mov_resp.data or len(mov_resp.data) == 0:
        raise ValueError("Failed to record transfer movement")
    return mov_resp.data[0]


def transfer_sede_to_bodega(
    product_id: int, sede_id: int, quantity: int, user_id: str
) -> dict[str, Any]:
    """Move quantity from sede to bodega. Records movement with type transfer_sede_to_bodega."""
    if quantity <= 0:
        raise ValueError("Quantity must be positive")
    current_sede = _get_sede_product_quantity(sede_id, product_id)
    if current_sede < quantity:
        raise ValueError(
            f"Insufficient stock at sede for product {product_id}: have {current_sede}, requested {quantity}"
        )
    # 1. Decrease sede stock
    upsert_sede_stock(sede_id, product_id, current_sede - quantity)
    # 2. Increment bodega stock
    client = get_supabase_admin()
    try:
        client.rpc("increment_stock", {"p_id": product_id, "amount": quantity}).execute()
    except Exception as e:
        # Try to rollback sede (restore quantity)
        upsert_sede_stock(sede_id, product_id, current_sede)
        raise ValueError(f"Failed to update bodega stock: {str(e)}") from e
    # 3. Record movement
    movement_data = {
        "product_id": product_id,
        "movement_type": "transfer_sede_to_bodega",
        "quantity": quantity,
        "user_id": user_id,
        "sede_id": sede_id,
    }
    mov_resp = client.table("inventory_movements").insert(movement_data).execute()
    if not mov_resp.data or len(mov_resp.data) == 0:
        raise ValueError("Failed to record transfer movement")
    return mov_resp.data[0]
