# Local patches for ai-language-evaluator

Applied in order by `../Dockerfile` (`patch -p1 --fuzz=0`) on top of the pinned upstream commit
`EVALUATOR_REF`. The build fails if a patch no longer applies or if the patched tests fail.

## 0001-robust-band-parsing.patch

- **Band 0 by mistake.** Upstream reads scores only from lines like `Overall Band Score: 7` and
  returns 0.0 for anything it can't find, then reports success. The model often writes other
  formats (`Scoring: 8.0`, `**Score: 3.5**`, `Task Achievement (TA): 3.5`), so good essays were
  saved as band 0. Now:
  - those formats are recognised;
  - a missing overall band is computed from the four criteria (mean, rounded to the nearest half
    band, ties up), as IELTS does;
  - when no band can be read the model is asked again, up to `LLM_FORMAT_RETRIES` (default 2)
    more times, with a reminder of the format;
  - if there is still no band, the result is an `LLM_PARSE_ERROR`, not band 0. A real band 0 (the
    model writes `0`, e.g. for a memorised or off-topic answer) is still reported as 0.
- Leaked special tokens (`<|end_of_document|>`) and the text after them are cut from the feedback.
- No `Authorization: Bearer ` header when `HF_TOKEN` is empty (upstream fails every request).
- The model name comes from `LLM_MODEL_NAME` (upstream ignores it).
- Message retries go straight back to the worker's own queue, not to the shared
  `exam.writing.submitted` key, which delivered them to every queue bound to it. Parse errors are
  not re-queued (they were already retried against the model).
- The RabbitMQ password is masked in the connection log.
- `tests/test_scoring.py` covers the parsing (with the model's real answers) and the retries.

To change a patch: clone upstream, check out `EVALUATOR_REF`, apply the patches, edit, run
`python -m unittest discover -s tests`, then regenerate with `git diff <EVALUATOR_REF> > 0001-….patch`.
