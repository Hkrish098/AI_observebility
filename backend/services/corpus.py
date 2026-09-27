from models.schemas import RetrievedChunk

POLICY_CORPUS: list[RetrievedChunk] = [
    RetrievedChunk(
        chunk_id="policy-returns-01",
        source="Returns Policy v3",
        similarity=0.0,
        content=(
            "Customers may return unused items within 30 days of delivery. "
            "Refunds are issued to the original payment method within 5-7 business days. "
            "Opened electronics are eligible for store credit only."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-returns-02",
        source="Returns Policy v3",
        similarity=0.0,
        content=(
            "Return shipping is free for defective items. Change-of-mind returns require the customer "
            "to pay return postage unless the order included a prepaid label."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-shipping-01",
        source="Shipping Policy v2",
        similarity=0.0,
        content=(
            "Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. "
            "Orders placed after 2pm local warehouse time ship the next business day."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-shipping-02",
        source="Shipping Policy v2",
        similarity=0.0,
        content=(
            "International orders can take 7-14 business days. Customs fees are the buyer's responsibility. "
            "We do not ship to PO boxes for express service."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-orders-01",
        source="Order Status FAQ",
        similarity=0.0,
        content=(
            "Order status values are: processing, packed, in_transit, out_for_delivery, delivered, cancelled. "
            "Support agents may share tracking numbers after packed status."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-orders-02",
        source="Order Status FAQ",
        similarity=0.0,
        content=(
            "Cancellations are allowed only while an order is in processing. Once packed, the customer "
            "must refuse delivery or open a return after it arrives."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-warranty-01",
        source="Warranty Policy v1",
        similarity=0.0,
        content=(
            "Products include a 12-month manufacturer warranty covering defects in materials. "
            "Damage from misuse or unauthorized repairs is not covered."
        ),
    ),
    RetrievedChunk(
        chunk_id="policy-escalation-01",
        source="Support Playbook",
        similarity=0.0,
        content=(
            "Escalate to a human specialist for legal threats, chargeback notices, suspected fraud, "
            "or when the customer explicitly asks for a manager."
        ),
    ),
]
