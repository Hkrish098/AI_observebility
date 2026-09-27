from datetime import datetime, timedelta, timezone

MOCK_ORDERS = {
    "1001": {
        "order_id": "1001",
        "status": "in_transit",
        "carrier": "Northline Express",
        "tracking_number": "NLX-482910",
        "eta": (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat(),
        "items": ["Wireless headphones"],
    },
    "1002": {
        "order_id": "1002",
        "status": "delivered",
        "carrier": "CityPost",
        "tracking_number": "CP-11920",
        "eta": (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat(),
        "items": ["Standing desk"],
    },
}


def extract_order_id(query: str) -> str | None:
    cleaned = "".join(ch if ch.isalnum() else " " for ch in query)
    for token in cleaned.split():
        if token.isdigit() and len(token) >= 4:
            return token
    return None


async def get_order_status(order_id: str | None = None, query: str | None = None) -> dict:
    resolved = order_id or (extract_order_id(query) if query else None)
    if not resolved:
        return {
            "tool": "get_order_status",
            "status_code": 400,
            "ok": False,
            "error": "No order id found. Ask the customer for a 4+ digit order number.",
        }
    order = MOCK_ORDERS.get(resolved)
    if not order:
        return {
            "tool": "get_order_status",
            "status_code": 404,
            "ok": False,
            "error": f"Order {resolved} was not found in the mock warehouse system.",
        }
    return {"tool": "get_order_status", "status_code": 200, "ok": True, "data": order}


async def run_tools(intent: str, query: str, order_id: str | None = None) -> dict:
    if intent == "tool" or intent == "order_status":
        return await get_order_status(order_id=order_id, query=query)
    return {
        "tool": "none",
        "status_code": 200,
        "ok": True,
        "data": {"skipped": True, "reason": "No tool required for this intent."},
    }
