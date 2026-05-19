from fastapi import APIRouter, Depends, HTTPException, status
from core.protocol import PaymentIntent
from ..lib.auth import verify_clerk_session
from ..main import settings
import stripe

router = APIRouter()

@router.post("/create-intent", response_model=PaymentIntent)
async def create_payment_intent(
    amount: int,
    user_id: str = Depends(verify_clerk_session)
) -> PaymentIntent:
    """
    Isolated Server-Side Stripe Interaction.
    Enforces server-side proxying to prevent secret exposure.
    Strictly uses the settings configuration.
    """
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY == "placeholder":
         raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway unconfigured"
        )

    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
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
