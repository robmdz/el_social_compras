"""
Orders API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import require_admin, require_any_role, require_user_or_admin
from app.models.orders import (
    OrderCreate,
    OrderItemCreate,
    OrderItemUpdate,
    OrderItemResponse,
    OrderResponse,
    StatusUpdate,
)
import app.services.order_service as order_service
import app.services.pdf_service as pdf_service

router = APIRouter()


@router.post("/", response_model=OrderResponse)
async def create_order(
    body: OrderCreate,
    current_user: dict = Depends(require_user_or_admin),
):
    try:
        data = order_service.create_order(
            user_id=current_user["id"],
            sede_id=body.sede_id,
            executor_type=body.executor_type.value,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=list[OrderResponse])
def list_orders(
    sede_id: int | None = Query(None),
    order_status: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_any_role),
):
    try:
        user_filter = current_user["id"] if current_user.get("role") == "user" else None
        data = order_service.get_orders(
            sede_id=sede_id,
            status=order_status,
            user_id=user_filter,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/comparison")
async def get_orders_comparison_by_sede(
    order_status: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_admin),
):
    try:
        data = order_service.get_orders_comparison_by_sede(status=order_status)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: dict = Depends(require_any_role),
):
    try:
        data = order_service.get_order_with_savings(order_id)
        if current_user.get("role") == "user" and data.get("user_id") != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this order",
            )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_id}/items", response_model=OrderItemResponse)
async def add_order_item(
    order_id: int,
    body: OrderItemCreate,
    current_user: dict = Depends(require_user_or_admin),
):
    try:
        data = order_service.add_order_item(
            order_id=order_id,
            product_id=body.product_id,
            quantity_requested=body.quantity_requested,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{order_id}/items/{item_id}", response_model=OrderItemResponse)
async def update_order_item(
    order_id: int,
    item_id: int,
    body: OrderItemUpdate,
    current_user: dict = Depends(require_user_or_admin),
):
    try:
        data = order_service.update_order_item(
            item_id=item_id,
            data=body.model_dump(exclude_unset=True),
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_item(
    order_id: int,
    item_id: int,
    current_user: dict = Depends(require_user_or_admin),
):
    try:
        order_service.delete_order_item(item_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    body: StatusUpdate,
    current_user: dict = Depends(require_any_role),
):
    try:
        data = order_service.update_order_status(
            order_id=order_id,
            new_status=body.status.value,
            user_role=current_user["role"],
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{order_id}/savings-report/pdf")
async def get_savings_report_pdf(
    order_id: int,
    current_user: dict = Depends(require_any_role),
):
    try:
        pdf_bytes = pdf_service.generate_savings_pdf(order_id)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=order-{order_id}-savings.pdf"
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{order_id}/grouped-by-supplier")
async def get_grouped_by_supplier(
    order_id: int,
    current_user: dict = Depends(require_any_role),
):
    try:
        order = order_service.get_order(order_id)
        if current_user.get("role") == "user" and order.get("user_id") != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this order",
            )
        data = order_service.get_grouped_items_by_supplier(order_id)
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{order_id}/purchase-list/pdf")
async def get_purchase_list_pdf(
    order_id: int,
    current_user: dict = Depends(require_any_role),
):
    try:
        order = order_service.get_order(order_id)
        if current_user.get("role") == "user" and order.get("user_id") != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this order",
            )
        pdf_bytes = pdf_service.generate_purchase_list_pdf(order_id)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=order-{order_id}-purchase-list.pdf"
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


