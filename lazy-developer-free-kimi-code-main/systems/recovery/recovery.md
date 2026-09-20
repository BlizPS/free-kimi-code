# Recovery

Classify the failure before changing code.

Authentication failures stop for credential correction. Rate limits, timeouts, and transient network failures may retry within a small budget. Context failures compact first. Tool or syntax failures require mechanism-level repair followed by verification. Never replay a committed stream as though nothing was emitted.
