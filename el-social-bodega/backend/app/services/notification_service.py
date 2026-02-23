"""Notification service — user notifications and admin alerts."""

from typing import List, Any
from app.db.client import get_supabase_admin


def get_notifications(user_id: str) -> List[dict[str, Any]]:
    """Select from notifications where user_id matches, ordered by created_at desc."""
    client = get_supabase_admin()
    response = (
        client.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def mark_as_read(notification_id: int) -> dict[str, Any]:
    """Update notification read=True."""
    client = get_supabase_admin()
    response = (
        client.table("notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .execute()
    )
    if not response.data or len(response.data) == 0:
        raise ValueError(f"Notification with id {notification_id} not found")
    return response.data[0]


def create_notification(
    user_id: str,
    type: str,
    message: str,
    product_id: int | None = None,
) -> dict[str, Any]:
    """Insert into notifications. product_id is used for type new_product_request (approve action)."""
    client = get_supabase_admin()
    data = {"user_id": user_id, "type": type, "message": message}
    if product_id is not None:
        data["product_id"] = product_id
    response = client.table("notifications").insert(data).execute()
    if not response.data or len(response.data) == 0:
        raise ValueError("Failed to create notification")
    return response.data[0]


def _get_admin_user_ids() -> List[str]:
    """Get all user IDs with admin role."""
    client = get_supabase_admin()
    response = (
        client.table("users")
        .select("id")
        .eq("role", "admin")
        .execute()
    )
    return [r["id"] for r in (response.data or [])]


def notify_low_stock(
    product_id: int,
    product_name: str,
    current_qty: int,
    min_stock: int,
) -> None:
    """Create notification for all admin users about low stock."""
    message = (
        f"Stock bajo: {product_name} tiene {current_qty} unidades "
        f"(mínimo: {min_stock}). Déficit: {min_stock - current_qty}."
    )
    admin_ids = _get_admin_user_ids()
    for uid in admin_ids:
        create_notification(uid, "low_stock", message)


def notify_new_order(order_id: int, sede_name: str) -> None:
    """Create notification for all admin users about new order submitted."""
    message = f"Nuevo pedido #{order_id} enviado desde sede: {sede_name}."
    admin_ids = _get_admin_user_ids()
    for uid in admin_ids:
        create_notification(uid, "new_order", message)


def notify_price_spike(
    product_name: str,
    supplier_name: str,
    old_price: float,
    new_price: float,
    pct_change: float,
) -> None:
    """Create notification for all admin users about price spike."""
    message = (
        f"Alza de precio: {product_name} - {supplier_name}. "
        f"Precio anterior: {old_price:.2f}, nuevo: {new_price:.2f} "
        f"(+{pct_change:.1f}%)."
    )
    admin_ids = _get_admin_user_ids()
    for uid in admin_ids:
        create_notification(uid, "price_spike", message)


def notify_product_suggestion(
    product_id: int,
    product_name: str,
    creator_email: str,
) -> None:
    """Notify admins when a leader suggests a new product. Include product_id for approve action."""
    message = (
        f"Nuevo insumo sugerido: {product_name}. "
        f"Creado por: {creator_email}. Pendiente de aprobación."
    )
    admin_ids = _get_admin_user_ids()
    for uid in admin_ids:
        create_notification(uid, "new_product_request", message, product_id=product_id)
