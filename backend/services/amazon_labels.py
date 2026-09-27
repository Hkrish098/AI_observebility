"""Amazon support labels for RAG sampling and the eval set.

Intents: shipping_inquiry, delivery_failed, return_refund, cancel_modify,
account_prime, product_quality, other
Routes: auto | escalate
"""

from __future__ import annotations

import re

INTENTS = (
    "shipping_inquiry",
    "delivery_failed",
    "return_refund",
    "cancel_modify",
    "account_prime",
    "product_quality",
    "other",
)

DM_PATTERNS = (
    "please dm",
    "private message",
    "message us",
    "dm your",
    "direct message",
    "send us a dm",
    "dm us",
    "please send us a private",
    "unable to affect your account via twitter",
    "phone or chat",
    "reach us by phone",
    "please reach us",
    "https://t.co/",
)

_DELIVERED_MISSING = re.compile(
    r"(says? delivered|marked delivered|show(?:s|ing) delivered|delivered (?:but|and)|never (?:arrived|showed|came)|not (?:here|received|delivered))",
    re.I,
)
_ORDER_ID = re.compile(r"\b\d{3}-\d{7}-\d{7}\b")


def ascii_ratio(text: str) -> float:
    if not text:
        return 0.0
    return sum(ch.isascii() for ch in text) / max(len(text), 1)


def is_dm_style(text: str) -> bool:
    low = text.lower()
    return any(p in low for p in DM_PATTERNS)


def categorize_reply(text: str) -> str:
    low = text.lower()
    if any(w in low for w in ("track", "shipping", "delivery", "carrier", "package")):
        return "shipping"
    if any(w in low for w in ("refund", "return", "replacement")):
        return "refund"
    if "order" in low:
        return "order"
    if any(w in low for w in ("account", "login", "prime", "password")):
        return "account"
    return "other"


def label_customer(text: str) -> dict:
    raw = text or ""
    low = raw.lower()

    legal = any(
        w in low
        for w in ("sue", "lawyer", "attorney", "legal action", "chargeback", "court", "lawsuit")
    )
    fraud = any(w in low for w in ("fraud", "stolen card", "identity theft", "hacked"))
    pii = bool(re.search(r"(?<!\d-)\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", raw)) and not has_order_id(raw)
    angry_repeat = any(
        w in low
        for w in (
            "several times",
            "multiple times",
            "no one is responding",
            "worst customer",
            "3 different people",
        )
    )
    delivered_missing = bool(_DELIVERED_MISSING.search(raw)) or (
        "was not" in low and "delivered" in low
    )

    if legal:
        intent = "other"
        route = "escalate"
        reason = "Legal threat or chargeback — human only"
    elif fraud:
        intent = "account_prime"
        route = "escalate"
        reason = "Fraud / account compromise"
    elif delivered_missing:
        intent = "delivery_failed"
        route = "escalate"
        reason = "Marked delivered or never arrived — needs account lookup"
    elif any(w in low for w in ("refund", "return", "wrong item", "charged twice", "double charg")):
        intent = "return_refund"
        delayed = any(w in low for w in ("never got", "still waiting", "weeks"))
        route = "escalate" if delayed else "auto"
        reason = "Refund already delayed / disputed" if delayed else "Standard return/refund policy question"
    elif any(w in low for w in ("cancel", "change address", "wrong address")):
        intent = "cancel_modify"
        route = "auto"
        reason = "Cancel or modify request — usually playbook"
    elif any(w in low for w in ("prime", "login", "password", "account")):
        intent = "account_prime"
        route = "auto"
        reason = "Account/Prime question"
    elif any(w in low for w in ("broken", "damaged", "defective", "doesn't work", "does not work")):
        intent = "product_quality"
        route = "escalate"
        reason = "Physical defect usually needs order + replacement flow"
    elif any(w in low for w in ("track", "tracking", "where is", "eta", "when will", "package", "shipping")):
        intent = "shipping_inquiry"
        route = "auto"
        reason = "Tracking / ETA — answerable from historical Amazon replies"
    else:
        intent = "other"
        route = "auto"
        reason = "No high-risk pattern; try grounded reply then human if weak match"

    if pii and route == "auto":
        route = "escalate"
        reason = "Phone number in the tweet — don't handle in public"
    if angry_repeat and intent in {"shipping_inquiry", "return_refund", "other"}:
        route = "escalate"
        reason = "Repeated failed contacts — escalate"

    needs_review = intent == "other"
    return {
        "intent": intent,
        "route": route,
        "reason": reason,
        "needs_review": needs_review,
        "label_method": "rubric_v1",
    }


def has_order_id(text: str) -> bool:
    return bool(_ORDER_ID.search(text or ""))


def read_tone(text: str) -> dict:
    low = (text or "").lower()
    angry = any(
        w in low
        for w in (
            "angry",
            "furious",
            "worst",
            "ridiculous",
            "unacceptable",
            "sue",
            "scam",
            "hate",
            "useless",
            "terrible",
            "disgusting",
        )
    ) or "!!!" in (text or "")
    worried = any(
        w in low
        for w in ("worried", "anxious", "please help", "scared", "urgent", "asap", "help me")
    )
    if angry:
        return {"emotion": "frustrated", "criticality": "high"}
    if worried:
        return {"emotion": "worried", "criticality": "medium"}
    if any(w in low for w in ("refund", "charged", "never arrived", "says delivered", "fraud")):
        return {"emotion": "concerned", "criticality": "medium"}
    return {"emotion": "calm", "criticality": "low"}


def decide_route(query: str, groq_intent: str, top_similarity: float | None) -> dict:
    labeled = label_customer(query)
    tone = read_tone(query)
    base = {
        "intent": labeled["intent"],
        "emotion": tone["emotion"],
        "criticality": tone["criticality"],
    }
    needs_id = labeled["intent"] in {"shipping_inquiry", "delivery_failed", "cancel_modify"}
    if needs_id and not has_order_id(query) and groq_intent != "escalate" and labeled["route"] != "escalate":
        return {
            **base,
            "route": "clarify",
            "reason": "Order id is missing, so we ask before searching or escalating",
            "criticality": "low" if tone["criticality"] == "low" else tone["criticality"],
        }
    if groq_intent == "escalate" or labeled["route"] == "escalate":
        return {
            **base,
            "route": "escalate",
            "reason": labeled["reason"],
            "criticality": "high",
        }
    if labeled["intent"] == "other" and (top_similarity is None or top_similarity < 0.2):
        return {
            **base,
            "route": "clarify",
            "reason": "Tweet is too thin to answer or escalate",
        }
    return {**base, "route": "auto", "reason": labeled["reason"]}
