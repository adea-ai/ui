import { FolderOpen, Mail } from 'lucide-solid'
import { render } from 'solid-js/web'
import { EntityIcon } from '../../src/components/ui/entity-icon/entity-icon'
import { RadioGroup, RadioGroupItem } from '../../src/components/ui/radio-group/radio-group'
import '../../src/styles/globals.css'

function RadioCardFixture() {
  return (
    <main class="flex w-96 flex-col gap-6 p-4">
      <RadioGroup defaultValue="folder" aria-label="Label only">
        <RadioGroupItem
          variant="card"
          value="folder"
          label="Folder"
          media={<EntityIcon name="Folder" size="sm" icon={FolderOpen} />}
        />
        <RadioGroupItem variant="card" value="plain" label="Plain text" />
      </RadioGroup>
      <RadioGroup defaultValue="mail" aria-label="With description">
        <RadioGroupItem
          variant="card"
          value="mail"
          label="Mail"
          description="Index messages from a connected mailbox, including every attachment that the mailbox exposes."
          media={<EntityIcon name="Mail" size="sm" icon={Mail} />}
        />
      </RadioGroup>
      <RadioGroup defaultValue="light" aria-label="Bare rows">
        <RadioGroupItem value="light" label="Light" description="Always light." />
      </RadioGroup>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(() => <RadioCardFixture />, root)
