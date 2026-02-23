"""Order service — orders, order items, status transitions, savings."""

from typing import Optional, List, Any
from app.db.client import get_supabase_admin
from app.models.orders import OrderStatus, VALID_TRANSITIONS

from app.services.suggestion_service import get_best_supplier_for_product


def create_order(
    user_id: str,
    sede_id: int,
    executor_type: str = "admin_managed",
) -> dict[str, Any]:
    """Insert into orders with status 'draft'."""
    client = get_supabase_admin()
    data = {
        "user_id": user_id,
        "sede_id": sede_id,
        "status": "draft",
        "executor_type": executor_type,
    }
    response = client.table("orders").insert(data).execute()

    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to create order")

    return response.data[0]


def get_orders(
    sede_id: Optional[int] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[dict[str, Any]]:
    """Select from orders with optional filters, join sedes for sede_name."""
    client = get_supabase_admin()
    query = client.table("orders").select("*, sedes(name)")

    if sede_id is not None:
        query = query.eq("sede_id", sede_id)
    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("user_id", user_id)

    response = query.order("created_at", desc=True).execute()
    rows = response.data or []

    for row in rows:
        sedes = row.get("sedes")
        if isinstance(sedes, dict):
            row["sede_name"] = sedes.get("name")
        elif isinstance(sedes, list) and sedes:
            row["sede_name"] = sedes[0].get("name") if sedes[0] else None
        else:
            row["sede_name"] = None
        if "sedes" in row:
            del row["sedes"]

    return rows


def get_order(order_id: int) -> dict[str, Any]:
    """Get order with items, including product names and suggestion data."""
    client = get_supabase_admin()
    order_resp = (
        client.table("orders")
        .select("*, sedes(name)")
        .eq("id", order_id)
        .execute()
    )

    if not order_resp.data or len(order_resp.data) == 0:
        raise ValueError(f"Order with id {order_id} not found")

    order = order_resp.data[0]
    sedes = order.get("sedes")
    if isinstance(sedes, dict):
        order["sede_name"] = sedes.get("name")
    elif isinstance(sedes, list) and sedes:
        order["sede_name"] = sedes[0].get("name") if sedes[0] else None
    else:
        order["sede_name"] = None
    if "sedes" in order:
        del order["sedes"]

    items_resp = (
        client.table("order_items")
        .select("*, products(name, code)")
        .eq("order_id", order_id)
        .execute()
    )
    items = items_resp.data or []

    for item in items:
        products = item.get("products")
        if isinstance(products, dict):
            item["product_name"] = products.get("name")
            item["product_code"] = products.get("code")
        elif isinstance(products, list) and products:
            item["product_name"] = products[0].get("name") if products[0] else None
            item["product_code"] = products[0].get("code") if products[0] else None
        else:
            item["product_name"] = None
            item["product_code"] = None
        if "products" in item:
            del item["products"]

        best = get_best_supplier_for_product(item["product_id"])
        if best:
            item["suggested_supplier_id"] = best["supplier_id"]
            item["suggested_supplier_name"] = best["supplier_name"]
            item["suggested_price"] = best["price"]
            item["highest_price"] = best.get("highest_price") or best["price"]
        else:
            item["suggested_supplier_id"] = None
            item["suggested_supplier_name"] = None
            item["suggested_price"] = None
            item["highest_price"] = None

    order["items"] = items
    return order


def add_order_item(
    order_id: int,
    product_id: int,
    quantity_requested: int,
) -> dict[str, Any]:
    """Insert into order_items. Call suggestion_service to compute suggested_supplier_id, suggested_price."""
    client = get_supabase_admin()
    best = get_best_supplier_for_product(product_id)

    data = {
        "order_id": order_id,
        "product_id": product_id,
        "quantity_requested": quantity_requested,
        "suggested_supplier_id": best["supplier_id"] if best else None,
        "suggested_price": best["price"] if best else None,
    }

    response = client.table("order_items").insert(data).execute()
    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to add order item")

    return response.data[0]


def update_order_item(item_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Update order item (e.g. quantity if provided)."""
    client = get_supabase_admin()
    filtered = {k: v for k, v in data.items() if v is not None}

    if not filtered:
        response = client.table("order_items").select("*").eq("id", item_id).execute()
        if not response.data or len(response.data) == 0:
            raise ValueError(f"Order item with id {item_id} not found")
        return response.data[0]

    response = client.table("order_items").update(filtered).eq("id", item_id).execute()
    if not response.data or len(response.data) == 0:
        raise ValueError(f"Order item with id {item_id} not found")

    return response.data[0]


def delete_order_item(item_id: int) -> None:
    """Delete from order_items."""
    client = get_supabase_admin()
    response = client.table("order_items").delete().eq("id", item_id).execute()
    # Supabase returns an empty list (not None) when no rows matched
    if not response.data:
        raise ValueError(f"Order item with id {item_id} not found")


def update_order_status(
    order_id: int,
    new_status: str,
    user_role: str,
) -> dict[str, Any]:
    """Validate transition using VALID_TRANSITIONS and apply atomically.
    Uses a conditional UPDATE (WHERE status = current_status) to prevent race
    conditions where two concurrent requests both read the same current status.
    Only admin can approve/reject/dispatch. Raises ValueError on invalid transition.
    """
    admin_only_statuses = {"approved", "rejected", "dispatched"}
    if new_status in admin_only_statuses and user_role != "admin":
        raise ValueError("Only admin can approve, reject, or dispatch orders")

    client = get_supabase_admin()
    order_resp = client.table("orders").select("status").eq("id", order_id).execute()

    if not order_resp.data or len(order_resp.data) == 0:
        raise ValueError(f"Order with id {order_id} not found")

    current = order_resp.data[0]["status"]
    try:
        current_enum = OrderStatus(current)
        new_enum = OrderStatus(new_status)
    except ValueError:
        raise ValueError(f"Invalid status: {new_status}")

    allowed = VALID_TRANSITIONS.get(current_enum, [])
    if new_enum not in allowed:
        raise ValueError(
            f"Invalid transition from {current} to {new_status}. Allowed: {[s.value for s in allowed]}"
        )

    # Conditional UPDATE: only succeeds if status is still what we read above.
    # If another request changed it in the meantime this returns 0 rows,
    # preventing double-transitions (race condition, Issue #4).
    response = (
        client.table("orders")
        .update({"status": new_status})
        .eq("id", order_id)
        .eq("status", current)   # <- the race-safety guard
        .execute()
    )
    if not response.data or len(response.data) == 0:
        raise ValueError(
            "Order status was changed by another request. Please refresh and try again."
        )

    return response.data[0]


def get_order_with_savings(order_id: int) -> dict[str, Any]:
    """Get order items with full savings data (suggested vs highest price per item, totals)."""
    order = get_order(order_id)
    items = order.get("items", [])

    total_suggested = 0.0
    total_highest = 0.0

    for item in items:
        qty = item.get("quantity_requested", 0)
        suggested = item.get("suggested_price") or 0
        highest = item.get("highest_price") or suggested
        item["savings_per_item"] = (highest - suggested) * qty
        total_suggested += suggested * qty
        total_highest += highest * qty

    order["total_suggested_cost"] = total_suggested
    order["total_highest_cost"] = total_highest
    order["total_savings"] = total_highest - total_suggested
    return order


def get_orders_comparison_by_sede(
    status: Optional[str] = None,
) -> List[dict[str, Any]]:
    """Return aggregated order metrics grouped by sede, including estimated savings."""
    client = get_supabase_admin()
    query = client.table("orders").select("id, sede_id, status, sedes(name)")
    if status:
        query = query.eq("status", status)
    orders = query.execute().data or []
    if not orders:
        return []

    grouped: dict[int, dict[str, Any]] = {}
    for order in orders:
        raw_sede = order.get("sedes")
        if isinstance(raw_sede, dict):
            sede_name = raw_sede.get("name")
        elif isinstance(raw_sede, list) and raw_sede:
            sede_name = raw_sede[0].get("name")
        else:
            sede_name = f"Sede {order['sede_id']}"

        if order["sede_id"] not in grouped:
            grouped[order["sede_id"]] = {
                "sede_id": order["sede_id"],
                "sede_name": sede_name,
                "orders_count": 0,
                "by_status": {},
                "total_suggested_cost": 0.0,
                "total_highest_cost": 0.0,
                "total_savings": 0.0,
            }

        group = grouped[order["sede_id"]]
        group["orders_count"] += 1
        current_status = order.get("status") or "unknown"
        group["by_status"][current_status] = group["by_status"].get(current_status, 0) + 1

        # Include requested savings metric based on suggested vs highest prices.
        with_savings = get_order_with_savings(order["id"])
        group["total_suggested_cost"] += with_savings.get("total_suggested_cost") or 0.0
        group["total_highest_cost"] += with_savings.get("total_highest_cost") or 0.0
        group["total_savings"] += with_savings.get("total_savings") or 0.0

    return sorted(grouped.values(), key=lambda item: item["sede_name"])


def get_grouped_items_by_supplier(order_id: int) -> List[dict[str, Any]]:
    """Group order items by suggested supplier for operational purchase view."""
    order = get_order_with_savings(order_id)
    grouped: dict[str, dict[str, Any]] = {}

    for item in order.get("items", []):
        supplier_id = item.get("suggested_supplier_id")
        key = str(supplier_id) if supplier_id is not None else "unassigned"
        supplier_name = item.get("suggested_supplier_name") or "Sin proveedor sugerido"
        if key not in grouped:
            grouped[key] = {
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "items": [],
                "subtotal": 0.0,
            }
        quantity = item.get("quantity_requested") or 0
        price = item.get("suggested_price") or 0
        line_total = quantity * price
        grouped[key]["items"].append(
            {
                "id": item.get("id"),
                "product_id": item.get("product_id"),
                "product_name": item.get("product_name"),
                "product_code": item.get("product_code"),
                "quantity_requested": quantity,
                "suggested_price": price,
                "line_total": line_total,
            }
        )
        grouped[key]["subtotal"] += line_total

    return list(grouped.values())
