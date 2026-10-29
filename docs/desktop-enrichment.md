# Desktop model setup for vocabulary fills

Run this from a checkout on the Omarchy desktop:

```bash
pnpm install --frozen-lockfile
bash scripts/setup-enrichment.sh --check  # inspection only; missing tools return status 1
bash scripts/setup-enrichment.sh
```

The wizard checks Vulkan, guides model download and server startup, saves private endpoint settings,
and runs a first small fill for you to review after GitHub authentication. Its
`--help` and `--check` paths install nothing, write nothing and open no browser. It does not need
Wake-on-LAN or a self-hosted runner. Stop the server terminal when finished.

## Desktop prerequisites and candidates

Checked against primary documentation on 2026-10-29. Use Arch's [llama-cpp package](https://archlinux.org/packages/extra/x86_64/llama-cpp/)
with [ggml-vulkan](https://archlinux.org/packages/extra/x86_64/ggml-vulkan/),
[vulkan-radeon](https://archlinux.org/packages/extra/x86_64/vulkan-radeon/) and
[vulkan-tools](https://archlinux.org/packages/extra/x86_64/vulkan-tools/):

```bash
sudo pacman -Syu --needed llama-cpp ggml-vulkan vulkan-radeon vulkan-tools
vulkaninfo --summary
llama-server --list-devices
```

Both device checks must list the Radeon. A software renderer or CPU alone is insufficient.
This Vulkan route uses the distro's packages; it has not been benchmarked here. AMD's
[Radeon Linux support matrix](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityrad/native_linux/native_linux_compatibility.html)
includes the RX 9070 XT but does not list Arch among its supported operating systems. Do not apply
Ubuntu ROCm installation commands to Omarchy.

Start by comparing the publisher's [Qwen3-4B-GGUF](https://huggingface.co/Qwen/Qwen3-4B-GGUF)
and [Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF) Q4_K_M files. Both cards state
Apache-2.0 licensing. In the Files view, select the quantization, record the repository revision
and download the GGUF. [Qwen's llama.cpp guide](https://qwen.readthedocs.io/en/v3.0/run_locally/llama.cpp.html)
documents this runtime. These are comparison candidates, not a recommendation based on measurements.
File size alone does not establish runtime VRAM fit.

The Arch llama-cpp package was flagged out of date when checked. Inspect `llama-server --help`
and verify model/flag support. If it cannot load the selected model, use a pinned upstream release
and follow the [Vulkan build instructions](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md#vulkan).
From that checked-out release, the build commands are:

```bash
cmake -B build -DGGML_VULKAN=ON
cmake --build build --config Release --target llama-server
# Use build/bin/llama-server below and record its --version output.
```

## Start and check the endpoint

In a separate desktop terminal, substitute the absolute model path:

```bash
llama-server -m /absolute/path/to/chosen-model.gguf \
  --alias vegdex-enrich --host 127.0.0.1 --port 8080 \
  --n-gpu-layers 99 --ctx-size 16384 \
  --chat-template-kwargs '{"enable_thinking":false}'
curl --fail --silent --show-error http://127.0.0.1:8080/health
curl --fail --silent --show-error http://127.0.0.1:8080/v1/models
```

The [server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
documents chat completions, model aliases, template parameters and readiness checks. `/health`
returns 503 during loading. Confirm Radeon GPU-layer offload in the startup logs and record actual
memory use; a successful HTTP response does not prove GPU offload. The Qwen template setting disables
thinking so the response budget is available for answers. A batch of 40 items with its instructions
needs the larger context. These server-specific settings do not change the provider-neutral endpoint contract.

## Run fills

The wizard writes `.env.enrichment.local` with mode 0600, ignored by git. It stores the GGUF path,
model identity, server version, endpoint and advertised model ID there. Only `ENRICH_API_KEY` is
secret; the wizard captures it with hidden input. GitHub credentials stay with `gh auth login`.
To run fills later, load **and export** the environment from the repository root:

```bash
set -a
source .env.enrichment.local
set +a
pnpm enrich --kind name --lang it --size 40 --batches 10
git diff --stat -- packages/ingest/data/vocab
pnpm coverage
```

Without the wizard, export `ENRICH_BASE_URL=http://127.0.0.1:8080/v1` and `ENRICH_MODEL=vegdex-enrich`;
export `ENRICH_API_KEY` only for a server that requires bearer auth. Any endpoint supporting
nonstreaming OpenAI-compatible chat completions works. A paid endpoint receives one request per
batch, so set its own spending limit first.

Every answer passes the same checks as any other worker's (`docs/agents/vocabulary.md`). They catch
unsafe names, lost plant qualifiers, broken grammar and changed numbers; they cannot prove a name is
the one an Italian cook would use. Read the diff of a first run before running more, and discard a
bad one with `git checkout -- packages/ingest/data/vocab`. A small local model is weaker than a
hosted one; compare by running the same batch with each and reading both diffs.

## Values saved by the wizard

| Stage | Values and destination |
| --- | --- |
| Prerequisites / Vulkan | No captured values; package update requires confirmation. |
| Choose model / start server | `ENRICH_MODEL_FILE`, `ENRICH_MODEL_IDENTITY`, `ENRICH_SERVER_VERSION` in the private env file. Server command is displayed for a separate terminal. |
| Endpoint configuration | `ENRICH_BASE_URL`, `ENRICH_MODEL`, optional hidden `ENRICH_API_KEY` in the private env file; exported to child commands. |
| GitHub | Auth through `gh`, used to read the crawl store. No GitHub token is captured. |
| First fill | One batch of 20 Italian names into `packages/ingest/data/vocab/`, left uncommitted for review. |

The automated tests exercise the wizard's syntax/help/check paths. The wizard library matches the
skill template unchanged. ShellCheck passes with `shellcheck --exclude=SC1087,SC2317 scripts/setup-enrichment.sh`:
those exclusions cover the template's Readline prompt expansion and unused shared helpers. The real
interactive desktop stages remain for the owner to verify.
