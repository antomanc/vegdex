# Desktop enrichment setup and evaluation

Run this from a checkout on the Omarchy desktop:

```bash
pnpm install --frozen-lockfile
bash scripts/setup-enrichment.sh --check  # inspection only; missing tools return status 1
bash scripts/setup-enrichment.sh
```

The wizard checks Vulkan, guides model download and server startup, saves private endpoint settings,
runs the scored evaluation, and offers the remote enrich run after GitHub authentication. Its
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
  --n-gpu-layers 99 --ctx-size 4096 \
  --chat-template-kwargs '{"enable_thinking":false}'
curl --fail --silent --show-error http://127.0.0.1:8080/health
curl --fail --silent --show-error http://127.0.0.1:8080/v1/models
```

The [server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
documents chat completions, model aliases, template parameters and readiness checks. `/health`
returns 503 during loading. Confirm Radeon GPU-layer offload in the startup logs and record actual
memory use; a successful HTTP response does not prove GPU offload. The Qwen template setting disables
thinking so the response budget is available for translation. Keep that runtime setting identical
between evaluation and enrich. These server-specific settings do not change the provider-neutral
production endpoint contract.

## Reproduce and review an evaluation

The wizard writes `.env.enrichment.local` with mode 0600, ignored by git. It stores the public GGUF
path, model identity, server version, endpoint, advertised model ID and run labels there. Only
`ENRICH_API_KEY` is secret; the wizard captures it with hidden input and never sets a GitHub secret.
GitHub credentials stay with `gh auth login`. To run commands later, explicitly load **and export**
the environment from the repository root:

```bash
set -a
source .env.enrichment.local
set +a
pnpm eval:enrichment --label qwen4b-q4-run1 \
  --identity 'Qwen/Qwen3-4B-GGUF@<revision>/<filename>:Q4_K_M' \
  --server-version '<llama-server --version output>'
```

Without the wizard, export `ENRICH_BASE_URL=http://127.0.0.1:8080/v1` and
`ENRICH_MODEL=vegdex-enrich`; export `ENRICH_API_KEY` only for a server that requires bearer auth.
Any endpoint supporting nonstreaming OpenAI-compatible chat completions can be evaluated. A paid
endpoint will receive 14 requests per run, so set its own spending limit first.

Results go to `.data/evaluation/<label>.eval.json`. `--report-dir <directory>` selects an isolated
report directory; reports always use the `.eval.json` suffix and existing labels are refused.
The command never reads or writes the production queue or learned data. Keep the git revision,
server startup flags, model-file checksum (`sha256sum /path/to/model.gguf`), desktop GPU/memory
observations and report together when comparing runs. Reports record model identity, server version,
endpoint without credentials, evaluation version, request settings and timestamps.

The committed [14-case sample](../packages/ingest/data/enrichment-evaluation.json) retains recipe
IDs, publisher links and ingredient-line context from the October 2026 catalog. It covers real titles,
reusable preparation phrases, exact ingredient concepts, numbers, alternatives, vegan butter and the
ambiguous tofu "egg" title. The concept IDs come from the committed dictionary, credited to
[Open Food Facts contributors under ODbL/DbCL](../packages/ingest/data/README.md).
[Adversarial fake responses](../packages/ingest/test/fixtures/evaluation-adversarial.json) are separate
from source text and are not evidence about any model.

| Score | Interpretation |
| --- | --- |
| Meaning heuristic | Accepted proposals with the expected concept ID and every required lexical group. Each group permits listed Italian variants. Denominator: all 14 cases. |
| Response validity | Proposals accepted by the same `proposeEnrichment` validation used by enrich, including merge/fidelity checks. Denominator: all 14 cases. |
| Qualifier preservation | Accepted proposals retaining a plant-based qualifier on the two marked cases. Failed cases count as failures. |
| Safety failures | Proposals rejected as unsafe translation or lost qualification; fixed reasons appear per case. |

Exit status 1 means at least one score failed, including abstentions or request errors. Every case
stays in the denominator; a partial success cannot score 100%. Rejected text and provider error bodies
are never saved. Accepted proposals are saved for review. Meaning checks are lexical heuristics:
they can miss a wrong meaning and reject a valid synonym. They do not prove fluent or faithful Italian.
Compare each proposal with the source and expectations before selecting a model. Never select a run
with safety failures or lost qualifiers on the strength of an average score. The wizard blocks that
selection, and allows manual review of other heuristic failures.

No model has been run on the owner's GPU for this ticket. There is no measured winner, speed result
or VRAM promise. On the desktop, run both candidates with fresh labels and identical settings; inspect
all outputs, verify offload and memory use, and retain the reports before choosing.

## Values saved by the wizard

| Stage | Values and destination |
| --- | --- |
| Prerequisites / Vulkan | No captured values; package update requires confirmation. |
| Choose model / start server | `ENRICH_MODEL_FILE`, `ENRICH_MODEL_IDENTITY`, `ENRICH_SERVER_VERSION` in the private env file. Server command is displayed for a separate terminal. |
| Endpoint configuration | `ENRICH_BASE_URL`, `ENRICH_MODEL`, optional hidden `ENRICH_API_KEY` in the private env file; exported to child commands. |
| Evaluation / review | `ENRICH_EVAL_LABEL`, and `ENRICH_APPROVED_RUN` only after reviewing measured runs; isolated JSON report. |
| GitHub / enrich | GitHub auth through `gh`; confirmed `pnpm enrich` uploads accepted results and dispatches the existing deployment workflow. No GitHub token is captured. |

After selecting a measured model, `pnpm enrich` uses the exported endpoint settings. See the
[manual enrichment command](../README.md#manual-enrichment) for authentication, local-file mode and
remote behavior. `pnpm enrich --help` lists its options.

The automated tests run the public evaluation command against a fake HTTP server and exercise the
wizard's syntax/help/check paths. The wizard library matches the skill template unchanged. ShellCheck
passes with `shellcheck --exclude=SC1087,SC2317 scripts/setup-enrichment.sh`: those exclusions cover
the template's Readline prompt expansion and unused shared helpers. The real interactive desktop
stages remain for the owner to verify.
