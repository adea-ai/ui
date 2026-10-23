/**
 * The UI modules a packed scene-controls bundle may retain, per fixture. A
 * retained module outside this set fails the gate as "unrelated".
 *
 * `cn-tables.generated` rides along with `lib/utils` (`cn()` reads the class
 * tables); it is shared infrastructure, not an unrelated module. `lib/overlay`
 * rides along with the shared tooltip: #329 gave every tip the dialog surface's
 * top-layer exemption, so any bundle that renders a tooltip now carries it.
 * `lib/tooltip-focus-gate` is imported by the shared tooltip itself
 * (acquire/releaseTooltipFocusGate), so any bundle that renders a tooltip
 * carries it too.
 *
 * @param {string} fixtureName
 * @returns {RegExp}
 */
export function allowedPackedUi(fixtureName) {
  return fixtureName === 'scene-controls'
    ? /\/components\/(?:composites\/(?:scene-controls|action-button)|ui\/(?:button|spinner|tooltip))\/|\/lib\/(?:cn-tables\.generated|overlay|tooltip-focus-gate|utils|variants)\./
    : /\/components\/(?:composites\/action-button|ui\/(?:button|dropdown-menu|popover|spinner|tooltip))\/|\/lib\/(?:cn-tables\.generated|overlay|tooltip-focus-gate|utils|variants)\./
}
