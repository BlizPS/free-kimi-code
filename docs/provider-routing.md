# Free Kimi Code — Provider and Model Routing

Free Kimi Code uses Lazy Developer for provider and model routing across supported native coding CLIs.

## See what is available

Run:

```sh
lazydev setup
```

The setup flow shows the providers, models, credentials, and route choices available to your current installation. There is no fixed provider table in the documentation because new providers can be added over time.

## Tool capability handling

LazyDev detects whether the selected route exposes native tool calling. When it does, the native protocol is used. When it does not, the same model can use compatible local synthetic tool handling instead of being silently replaced by an unrelated model.

## Thinking and reasoning

When a route publishes reasoning/thinking metadata, LazyDev preserves the model-specific behavior where supported rather than applying one universal setting to every provider.

## Resilience

The routing layer also covers provider retries, authentication bridges, proxy boundaries, history repair, model capability metadata, and provider-specific compatibility behavior.

For the current provider catalog, always use `lazydev setup` instead of relying on an outdated list copied into documentation.
