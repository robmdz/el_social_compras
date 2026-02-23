"""
Inventory API routes — products, movements, prices, alerts.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import require_admin, require_any_role, require_user_or_admin
from app.models.inventory import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductSupplierLink,
    PriceEntry,
    MovementCreate,
    MovementResponse,
    LowStockAlert,
    SedeStockItem,
    SedeStockUpdate,
    TransferRequest,
)
import app.services.inventory_service as inventory_service
import app.services.notification_service as notification_service

router = APIRouter()


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    current_user: dict = Depends(require_any_role),
):
    """List products with optional search and category filters."""
    try:
        include_pending = current_user.get("role") == "admin"
        data = inventory_service.get_products(
            search=search,
            category=category,
            include_pending=include_pending,
        )
        return [ProductResponse(**item) for item in data]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    current_user: dict = Depends(require_any_role),
):
    """Get a single product by ID."""
    try:
        data = inventory_service.get_product(product_id)
        return ProductResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/products", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    current_user: dict = Depends(require_user_or_admin),
):
    """Create a new product."""
    try:
        role = current_user.get("role")
        payload = body.model_dump(exclude_unset=True)
        if role == "user":
            payload["is_pending"] = True
            payload["created_by"] = current_user.get("id")
        data = inventory_service.create_product(payload)
        if role == "user":
            notification_service.notify_product_suggestion(
                product_id=data["id"],
                product_name=data.get("name", "Insumo"),
                creator_email=current_user.get("email", "usuario"),
            )
        return ProductResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        detail = str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail or "Error al crear el producto. Revisa que las migraciones estén aplicadas.",
        )


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    body: ProductUpdate,
    current_user: dict = Depends(require_admin),
):
    """Update an existing product."""
    try:
        data = inventory_service.update_product(product_id, body.model_dump(exclude_unset=True))
        return ProductResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    current_user: dict = Depends(require_admin),
):
    """Delete a product."""
    try:
        inventory_service.delete_product(product_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/products/{product_id}/approve", response_model=ProductResponse)
async def approve_product(
    product_id: int,
    current_user: dict = Depends(require_admin),
):
    """Approve a pending product."""
    try:
        data = inventory_service.approve_product(product_id)
        return ProductResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/products/{product_id}/suppliers")
async def link_supplier(
    product_id: int,
    body: ProductSupplierLink,
    current_user: dict = Depends(require_admin),
):
    """Link a supplier to a product slot."""
    try:
        data = inventory_service.link_supplier(product_id, body.supplier_id, body.slot)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/products/{product_id}/suppliers/{slot}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_supplier(
    product_id: int,
    slot: int,
    current_user: dict = Depends(require_admin),
):
    """Unlink a supplier from a product slot."""
    try:
        inventory_service.unlink_supplier(product_id, slot)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/products/{product_id}/prices")
async def add_price_entry(
    product_id: int,
    body: PriceEntry,
    current_user: dict = Depends(require_admin),
):
    """Add a price entry for a product."""
    try:
        data = inventory_service.add_price(
            product_id, body.supplier_id, body.price, body.recorded_month, body.recorded_year
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/products/{product_id}/prices")
async def get_price_history(
    product_id: int,
    months: int = Query(12, ge=1, le=60),
    current_user: dict = Depends(require_any_role),
):
    """Get price history for a product."""
    try:
        data = inventory_service.get_price_history(product_id, months=months)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/products/{product_id}/price-comparison")
async def get_price_comparison(
    product_id: int,
    current_user: dict = Depends(require_any_role),
):
    """Get price comparison across suppliers for a product."""
    try:
        data = inventory_service.get_price_comparison(product_id)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/movements", response_model=MovementResponse)
async def create_movement(
    body: MovementCreate,
    current_user: dict = Depends(require_user_or_admin),
):
    """Create an inventory movement."""
    try:
        data = inventory_service.create_movement(body.model_dump(), user_id=current_user["id"])
        return MovementResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/movements")
async def list_movements(
    product_id: int | None = Query(None),
    movement_type: str | None = Query(None, alias="type"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    current_user: dict = Depends(require_any_role),
):
    """List movements with optional filters."""
    try:
        data = inventory_service.get_movements(
            product_id=product_id,
            movement_type=movement_type,
            date_from=date_from,
            date_to=date_to,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/alerts/low-stock", response_model=list[LowStockAlert])
def get_low_stock_alerts(
    current_user: dict = Depends(require_any_role),
):
    """Get low stock alerts."""
    try:
        data = inventory_service.get_low_stock_alerts()
        return [LowStockAlert(**item) for item in data]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sede-stock", response_model=list[SedeStockItem])
def get_sede_stock(
    sede_id: int = Query(..., description="Sede ID"),
    current_user: dict = Depends(require_any_role),
):
    """Get inventory (product quantities) for a specific sede."""
    try:
        data = inventory_service.get_sede_stock(sede_id)
        return [SedeStockItem(**item) for item in data]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/sede-stock", response_model=dict)
def upsert_sede_stock(
    body: SedeStockUpdate,
    sede_id: int = Query(..., description="Sede ID"),
    current_user: dict = Depends(require_admin),
):
    """Set quantity for a product at a sede (admin only)."""
    try:
        data = inventory_service.upsert_sede_stock(sede_id, body.product_id, body.quantity)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/transfer", response_model=MovementResponse)
def create_transfer(
    body: TransferRequest,
    current_user: dict = Depends(require_user_or_admin),
):
    """Transfer stock between bodega and a sede (bodega_to_sede or sede_to_bodega)."""
    if body.quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be positive")
    if body.direction not in ("bodega_to_sede", "sede_to_bodega"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="direction must be 'bodega_to_sede' or 'sede_to_bodega'",
        )
    try:
        if body.direction == "bodega_to_sede":
            data = inventory_service.transfer_bodega_to_sede(
                body.product_id, body.sede_id, body.quantity, current_user["id"]
            )
        else:
            data = inventory_service.transfer_sede_to_bodega(
                body.product_id, body.sede_id, body.quantity, current_user["id"]
            )
        return MovementResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
