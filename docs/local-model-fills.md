# Vocabulary fills with a local model

`pnpm enrich` sends gap batches to any endpoint that serves nonstreaming OpenAI-compatible chat
completions, and applies the answers that pass the vocabulary checks. A local
[llama.cpp](https://github.com/ggml-org/llama.cpp) server is one way to run it at no cost.

## Start a server

Build or install `llama-server` with GPU support for your hardware (see the
[build instructions](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)), then check
that it sees the GPU:

```bash
llama-server --list-devices
```

Pick an instruction model in GGUF format. [Qwen3-4B-GGUF](https://huggingface.co/Qwen/Qwen3-4B-GGUF)
and [Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF) (Q4_K_M, Apache-2.0) are reasonable
starting points to compare, not measured winners. Start the server in its own terminal:

```bash
llama-server -m /absolute/path/to/model.gguf \
  --alias vegdex-enrich --host 127.0.0.1 --port 8080 \
  --n-gpu-layers 99 --ctx-size 16384 \
  --chat-template-kwargs '{"enable_thinking":false}'
curl --fail --silent --show-error http://127.0.0.1:8080/health
```

`/health` returns 503 while the model loads. Check the startup logs for GPU layer offload: a working
HTTP response does not prove the model runs on the GPU. The template setting turns off Qwen's
thinking so the response budget goes to answers, and a batch of 40 items with its instructions needs
the larger context.

## Run fills

From the repository root:

```bash
export ENRICH_BASE_URL=http://127.0.0.1:8080/v1 ENRICH_MODEL=vegdex-enrich
pnpm enrich --kind name --lang it --size 40 --batches 10
git diff --stat -- packages/ingest/data/vocab
pnpm coverage
```

Export `ENRICH_API_KEY` only for a server that requires bearer auth. A paid endpoint receives one
request per batch, so set its spending limit first.

Every answer passes the same checks as any other worker's (`docs/agents/vocabulary.md`). They catch
unsafe names, lost plant qualifiers, broken grammar and changed numbers; they cannot prove a name is
the one an Italian cook would use. Read the diff of a first run before running more, and discard a
bad one with `git checkout -- packages/ingest/data/vocab`. A small local model is weaker than a
hosted one; compare by running the same batch with each and reading both diffs.
