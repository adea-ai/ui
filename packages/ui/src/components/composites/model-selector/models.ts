import { boundText } from '../sources/source'

/**
 * An effort level a model supports: just its id (`'high'`), or an id with the
 * words to show. A bare id is labelled by capitalising it, which is right for
 * `low` / `medium` / `high` and wrong for anything else — pass a label then.
 */
export type ModelEffort = string | Readonly<{ id: string; label?: string; description?: string }>

export type EffortOption = Readonly<{ id: string; label: string; description?: string }>

/**
 * A model the person may pick. `efforts` lists the effort levels *this* model
 * advertises; a model without it has no effort control, because showing one would
 * claim the model can be told how hard to think. `disabledReason` is the host's
 * authority speaking (plan, quota, region): the model stays in the list, disabled,
 * with the reason beside it.
 */
export type ModelOption = Readonly<{
  /** Unique within the list. */
  id: string
  label: string
  provider: string
  description?: string
  disabledReason?: string
  efforts?: readonly ModelEffort[]
}>

const LABEL_LIMIT = 60
const DESCRIPTION_LIMIT = 160

function titleCase(id: string): string {
  const clean = boundText(id, LABEL_LIMIT)
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** Efforts as options: blanks dropped, duplicate ids kept once (first wins), text bounded. */
export function normalizeEfforts(efforts: readonly ModelEffort[] | undefined): EffortOption[] {
  const seen = new Set<string>()
  const out: EffortOption[] = []
  for (const effort of efforts ?? []) {
    const id = typeof effort === 'string' ? effort : effort.id
    if (id.trim() === '' || seen.has(id)) continue
    seen.add(id)
    if (typeof effort === 'string') {
      out.push({ id, label: titleCase(id) })
    } else {
      out.push({
        id,
        label: (effort.label ? boundText(effort.label, LABEL_LIMIT) : '') || titleCase(id),
        description: effort.description
          ? boundText(effort.description, DESCRIPTION_LIMIT)
          : undefined,
      })
    }
  }
  return out
}

export function findModel(
  models: readonly ModelOption[],
  id: string | undefined
): ModelOption | undefined {
  return id === undefined ? undefined : models.find((model) => model.id === id)
}

/** The selected effort, only if the selected model actually offers it. */
export function resolveEffort(
  model: ModelOption | undefined,
  effort: string | undefined
): EffortOption | undefined {
  if (!model || effort === undefined) return undefined
  return normalizeEfforts(model.efforts).find((option) => option.id === effort)
}

export type ModelGroup = Readonly<{ provider: string; models: readonly ModelOption[] }>

/** Group by provider, in the order providers first appear, so the host controls ranking. */
export function groupModels(models: readonly ModelOption[]): ModelGroup[] {
  const groups = new Map<string, ModelOption[]>()
  for (const model of models) {
    const provider = boundText(model.provider, LABEL_LIMIT) || 'Other'
    const bucket = groups.get(provider)
    if (bucket) bucket.push(model)
    else groups.set(provider, [model])
  }
  return [...groups].map(([provider, list]) => ({ provider, models: list }))
}

/** Past this many models the list gets a search box; a short list is quicker to read. */
export const MODEL_SEARCH_THRESHOLD = 7

export function needsSearch(count: number, threshold = MODEL_SEARCH_THRESHOLD): boolean {
  return count > threshold
}

/**
 * What the search matches against: everything a person might type to find a model
 * — its name, its provider, its id, and its description.
 */
export function modelSearchValue(model: ModelOption): string {
  return [model.label, model.provider, model.id, model.description ?? ''].join(' ')
}
