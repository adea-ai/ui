import { render } from 'solid-js/web'
import { FieldGroup, FormField } from '../../src/components/ui/field/field'
import { Input } from '../../src/components/ui/input/input'
import '../../src/styles/globals.css'

function FieldGroupFixture() {
  return (
    <main class="flex flex-col gap-8 p-4">
      {[undefined, 2, 3].map((columns) => (
        <FieldGroup columns={columns as 2 | 3 | undefined} data-columns={columns ?? 'default'}>
          <FormField label={`First (${columns ?? 'default'})`}>
            <Input />
          </FormField>
          <FormField label={`Second (${columns ?? 'default'})`}>
            <Input />
          </FormField>
          <FormField label={`Third (${columns ?? 'default'})`}>
            <Input />
          </FormField>
          <FormField label={`Wide (${columns ?? 'default'})`} class="col-span-full">
            <Input />
          </FormField>
        </FieldGroup>
      ))}
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(() => <FieldGroupFixture />, root)
