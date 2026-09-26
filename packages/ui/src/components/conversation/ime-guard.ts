/*
 * Substantially translated from KiroCrew website/src/hooks/useImeGuard.ts
 * (`createImeLatch` and the textarea-scoped `useImeGuard` binding), pinned at
 * 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * This product includes software developed at Amazon.com, Inc.
 * (https://www.amazon.com/).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Native events replace React synthetic propagation; Solid ownership replaces
 * React refs/effects. No document listeners or focus trap are introduced.
 * A repeated compositionend replaces its old timer as well as a new start,
 * so an older expiry cannot prematurely release the new commit window.
 */
import { onCleanup } from 'solid-js'

const POST_COMPOSITION_MS = 50

/** Internal textarea guard: no application session or draft authority. */
export function createComposerImeGuard() {
  let latched = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const reset = () => {
    clearTimeout(timer)
    timer = undefined
    latched = false
  }
  onCleanup(reset)

  return {
    onCompositionStart() {
      clearTimeout(timer)
      timer = undefined
      latched = true
    },
    onCompositionEnd() {
      clearTimeout(timer)
      latched = true
      timer = setTimeout(() => {
        latched = false
        timer = undefined
      }, POST_COMPOSITION_MS)
    },
    onFocus: reset,
    onBlur: reset,
    /** Claim only a key the composer already recognizes as its send binding. */
    claimEnter(event: KeyboardEvent) {
      const nativeComposition = event.isComposing || event.keyCode === 229
      // Native IME commits retain their default action. Only the latch-only
      // post-commit window suppresses the newline a plain Enter would insert.
      if (!nativeComposition) event.preventDefault()
      if (latched || nativeComposition) {
        event.stopPropagation()
        return false
      }
      return true
    },
  }
}
