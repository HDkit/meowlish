# mock-ai-scorer

A dev/staging stand-in for the external AI writing scorer. It consumes the Writing answers exam sends for grading (`exam.writing.submitted`), waits a random 1-3 minutes, and publishes a random IELTS-style result (`exam.writing.scored`) in the same shape as the real scorer. No AI, no database, no gRPC API. The feedback text says it is a mock.

Run either this mock or the real scorer (below), never both: both would consume `exam.writing.submitted` and score every submission.

## Tech used

| Technology                                   | What for                                                                                                                                                                                                                                                             | Where                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| NestJS HTTP (health only)                    | Listens on `HOST:HEALTH_PORT` for `/health/live`, `/health/ready`                                                                                                                                                                                                    | `src/bootstrap.ts`                                                  |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`)      | Consumer on queue `mock-ai-scorer.writing.submitted` (declared with `defineConsumerQueue` from `@server/messaging`: retry queues and DLQ), prefetch 200; publishes the result straight to exchange `eventbus` with `AmqpConnection.publish` (no outbox: no database) | `src/configs/rmq.config.ts`, `src/app/writing-submitted.handler.ts` |
| zod (`zod/v4`)                               | Validates the incoming bare payload and the env                                                                                                                                                                                                                      | `src/app/score-generator.ts`, `src/configs/`                        |
| Score generator                              | Random bands 4.0-8.5 in 0.5 steps per criterion, overall = mean rounded to the nearest half band                                                                                                                                                                     | `src/app/score-generator.ts`                                        |
| Scoring delay                                | Uniform random wait between `MOCK_SCORER_MIN_DELAY_MS` and `MOCK_SCORER_MAX_DELAY_MS`; the message stays unacked meanwhile (prefetch bounds how many wait)                                                                                                           | `src/app/scoring-delay.ts`                                          |
| OpenTelemetry + health (`@server/telemetry`) | `startTelemetry`; `HealthModule` checks RabbitMQ                                                                                                                                                                                                                     | `src/main.ts`, `src/mock-ai-scorer.module.ts`                       |

No Postgres, no Redis, no BullMQ, no inbox (the input is a bare message without an event id; scoring twice only makes exam save feedback again).

## Talks to

Only RabbitMQ:

| Direction | Routing key              | Shape | Queue / exchange                                   | Other side                                                                                                                                    |
| --------- | ------------------------ | ----- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumes  | `exam.writing.submitted` | bare  | `mock-ai-scorer.writing.submitted`                 | Published by exam (`writing-submitted.ts`), with `attempt_id`, `response_id`, `question`, `content`, `exam_type`, `task_type`, `target_score` |
| Publishes | `exam.writing.scored`    | bare  | exchange `eventbus` → `exam.events.writing.scored` | exam `WritingScoredHandler` saves the feedback and recomputes the attempt score                                                               |

## Data

None. RabbitMQ holds its queue (`mock-ai-scorer.writing.submitted`, `.retry.1`-`.5`, `.dlq`). The queue is durable and stays bound after the mock stops, so it keeps collecting submissions: delete it when switching to the real scorer.

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `HEALTH_PORT`.
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `MOCK_SCORER_MIN_DELAY_MS`, `MOCK_SCORER_MAX_DELAY_MS`: delay range (defaults 60000 and 180000).
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run mock-ai-scorer:serve
pnpm exec nx run mock-ai-scorer:test
```

Port: health 9110. In Docker it starts only with `--profile mock-ai` (`docker/docker-compose.app.yaml`, depends on `rabbit-mq`). Its `ServiceMissing` alert (`docker/observability/alerting/platform.yaml`) is opt-in: it fires only if the mock ran in the last hour and then went quiet.

## The real scorer it stands in for (Docker profile `ai`)

The real scorer is external code that this repo's compose file builds and runs (`docker/docker-compose.app.yaml`), started with `docker compose --profile ai up -d`:

| Container   | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Health                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `ai-llm`    | llama.cpp server (`ghcr.io/ggml-org/llama.cpp:server-b12004`) serving [`linhma139/Phi-3-IELTS-Scorer`](https://huggingface.co/linhma139/Phi-3-IELTS-Scorer) (Phi-3-mini Q4_K_M GGUF, 2.2 GB, downloaded into volume `ai-models` on first start). CPU only, `--parallel 1` (one essay at a time), context 4096, answers capped at 512 tokens, repeat penalty 1.1; about 1-2 minutes per essay on 8 threads. Tuned with `AI_LLM_THREADS` and `AI_LLM_CPUS` (default 8), memory limit 4 GB. Internal OpenAI-style HTTP API `/v1/chat/completions` on 8080 | `GET /health` on 8080 (start period 15 min for the download) |
| `ai-scorer` | Python worker from [`linhma139/ai-language-evaluator`](https://github.com/linhma139/ai-language-evaluator) at a pinned commit (`EVALUATOR_REF`) plus local patches (`docker/ai-scorer/Dockerfile`, [`docker/ai-scorer/patches/README.md`](../../docker/ai-scorer/patches/README.md)); the image build runs the patched tests                                                                                                                                                                                                                           | `/health` on 8081 (Dockerfile `HEALTHCHECK`)                 |

How `ai-scorer` works:

- Declares and consumes its own queue `writing.evaluate` (bound to `exam.writing.submitted`, message TTL 1 h, dead letters to `writing.evaluate.dlq`), prefetch 1. It does not use `defineConsumerQueue`: retries carry an `x-retry-count` header and are re-published to its own queue (up to `MQ_MAX_RETRIES`).
- Essays below the IELTS minimum word counts are banded by rule without the model. Others go to `ai-llm`; when no band can be read from the answer it asks again (up to 2 more times, `LLM_FORMAT_RETRIES`) and finally reports `LLM_PARSE_ERROR` rather than a fake band 0.
- Publishes `exam.writing.scored` (bare) directly to `eventbus`. Upstream still leaves `corrected_version` and `corrections` empty.
- Compose environment: `RABBITMQ_URL`, `LLM_API_URL=http://ai-llm:8080/v1`, `LLM_TIMEOUT=600`, `MQ_PREFETCH_COUNT=1`, `MQ_MESSAGE_TTL=3600000`, `MQ_MAX_RETRIES=2`. It waits for `ai-llm` to be healthy.

Contract shared by the mock and the real scorer: input `exam.writing.submitted` (bare), output `exam.writing.scored` (bare: `{ status, attempt_id, response_id, data?, error_code?, error_message? }`, validated by `WritingScoredEvent` in `apps/exam/src/app/events/handlers/writing-scored.handler.ts`). `status: 'error'` is stored by exam as a failure record and never replaces a band.

Switching from the mock to the real scorer: stop `mock-ai-scorer` and delete its queues (`mock-ai-scorer.writing.submitted`, `.retry.1`-`.5`, `.dlq`); see `docs/operations.md`.

## More

- The Writing round trip end to end: [flows/exam.md](../../docs/architecture/flows/exam.md) and [messaging.md §8](../../docs/architecture/messaging.md#8-one-event-end-to-end-writing-submission--scorer--exam).
- Events: [messaging.md](../../docs/architecture/messaging.md).
