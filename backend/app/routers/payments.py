from fastapi import APIRouter, Depends, HTTPException, status
from core.protocol import PaymentIntent
from ..lib.auth import verify_clerk_session
import stripe
import os

router = APIRouter()

@router.post("/create-intent", response_model=PaymentIntent)
async def create_payment_intent(
    amount: int,
    user_id: str = Depends(verify_clerk_session)
) -> PaymentIntent:
    """
    Isolated Server-Side Stripe Interaction.
    Enforces server-side proxying to prevent secret exposure.
    Strictly uses the STRIPE_SECRET_KEY from environment.
    """
    stripe_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    if not stripe_key:
         raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway unconfigured"
        )

    try:
        stripe.api_key = stripe_key
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="zar",
            metadata={"user_id": user_id}
        )

        return PaymentIntent(
            id=str(intent.id),
            amount=int(intent.amount),
            currency=str(intent.currency).upper(),
            status=intent.status, # type: ignore
            client_secret=str(intent.client_secret)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
