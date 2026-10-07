import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import { Item, ItemDescription, ItemTitle } from '../../src/components/ui/item/item'
import '../../src/styles/globals.css'

const description =
  'Signed updates download in the background and install the next time the app is idle. Open workspaces, drafts and terminal sessions are restored after the restart, and nothing installs while a run is in progress.'

function actions(name: string) {
  return (
    <>
      <Button size="sm" variant="outline" aria-label={`Rename ${name}`}>
        Rename
      </Button>
      <Button size="sm" variant="destructive" aria-label={`Remove ${name}`}>
        Remove
      </Button>
    </>
  )
}

render(
  () => (
    <main class="flex flex-col items-start gap-4 p-2">
      <Item id="clamped" variant="outline" class="w-80">
        <ItemTitle>Clamped</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </Item>
      <Item id="unclamped" variant="outline" class="w-80">
        <ItemTitle>Unclamped</ItemTitle>
        <ItemDescription clamp={false}>{description}</ItemDescription>
      </Item>
      <Item id="narrow-default" variant="outline" class="w-80" trailing={actions('default')}>
        <ItemTitle>Design system</ItemTitle>
      </Item>
      <Item
        id="narrow-stacked"
        variant="outline"
        class="w-80"
        stackTrailing
        trailing={actions('stacked')}
      >
        <ItemTitle>Design system</ItemTitle>
      </Item>
      <Item
        id="wide-stacked"
        variant="outline"
        class="w-xl"
        stackTrailing
        trailing={actions('wide')}
      >
        <ItemTitle>Design system</ItemTitle>
      </Item>
    </main>
  ),
  document.body
)
