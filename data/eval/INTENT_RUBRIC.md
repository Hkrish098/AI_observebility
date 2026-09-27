# Amazon eval labels (rubric_v1)

Used in `data/eval/amazon_eval_250.xlsx`.

## Intents

| Label | Meaning |
| --- | --- |
| shipping_inquiry | Tracking, ETA, where is the package |
| delivery_failed | Marked delivered / never arrived / lost |
| return_refund | Return, refund, wrong item, double charge |
| cancel_modify | Cancel or change address/order |
| account_prime | Login, Prime, payment method |
| product_quality | Damaged / defective item |
| other | None of the above |

## Routes

| Label | Meaning |
| --- | --- |
| auto | Draft a grounded reply from historical AmazonHelp text |
| escalate | Send to a human (legal, fraud, missing after delivered, PII, repeated failures, no RAG match) |

`needs_review=True` → still double-check in Excel (`gold_intent` / `gold_route` columns).
`label_method=rubric_v1` is a documented ruleset, not a second human annotator.
