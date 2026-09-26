import { renderToString } from 'solid-js/web'
import { ConversationSurface } from '../../src/components/conversation/conversation-surface'

export const renderTranscript = () =>
  renderToString(() => (
    <ConversationSurface role="region" aria-label="Transcript">
      <p>A server-rendered reply.</p>
    </ConversationSurface>
  ))
