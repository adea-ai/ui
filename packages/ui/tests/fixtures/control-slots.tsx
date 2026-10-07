import { Search } from 'lucide-solid'
import { render } from 'solid-js/web'
import { ActionButton } from '../../src/components/composites/action-button/action-button'
import { ListRow } from '../../src/components/composites/list-row/list-row'
import { Badge } from '../../src/components/ui/badge/badge'
import { Button } from '../../src/components/ui/button/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/card/card'
import { Checkbox } from '../../src/components/ui/checkbox/checkbox'
import { EntityIcon } from '../../src/components/ui/entity-icon/entity-icon'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../src/components/ui/input-group'
import { NativeSelect } from '../../src/components/ui/native-select/native-select'
import { Progress } from '../../src/components/ui/progress/progress'
import { RadioGroup, RadioGroupItem } from '../../src/components/ui/radio-group/radio-group'
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select/select'
import { Slider } from '../../src/components/ui/slider/slider'
import { StatusChip } from '../../src/components/ui/status-chip/status-chip'
import { Switch } from '../../src/components/ui/switch/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs/tabs'
import { Toggle } from '../../src/components/ui/toggle/toggle'
import { ToggleGroup, ToggleGroupItem } from '../../src/components/ui/toggle-group/toggle-group'
import '../../src/styles/globals.css'

/**
 * Each control rendered alone inside a probe, so the spec can read the slot off
 * the probe's first element child — the control's real root in the DOM.
 */
render(
  () => (
    <main class="flex w-96 flex-col gap-3 p-4">
      <div data-probe="button">
        <Button>Save</Button>
      </div>
      <div data-probe="action-button">
        <ActionButton tooltip="Search the workspace." aria-label="Search">
          <Search />
        </ActionButton>
      </div>
      <div data-probe="badge">
        <Badge>Draft</Badge>
      </div>
      <div data-probe="status-chip">
        <StatusChip tone="success" label="Synced" />
      </div>
      <div data-probe="checkbox">
        <Checkbox aria-label="Include archived" />
      </div>
      <div data-probe="switch">
        <Switch aria-label="Sync on start" />
      </div>
      <div data-probe="toggle">
        <Toggle aria-label="Bold">B</Toggle>
      </div>
      <div data-probe="toggle-group">
        <ToggleGroup aria-label="Status filter">
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div data-probe="radio-group">
        <RadioGroup aria-label="Source type" defaultValue="folder">
          <RadioGroupItem value="folder" label="Folder" />
        </RadioGroup>
      </div>
      <div data-probe="select-trigger">
        <Select
          options={['One', 'Two']}
          placeholder="Pick one"
          itemComponent={(props) => (
            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
          )}
        >
          <SelectTrigger aria-label="Pick one">
            <SelectValue />
          </SelectTrigger>
        </Select>
      </div>
      <div data-probe="entity-icon">
        <EntityIcon name="Kitchen" />
      </div>
      <div data-probe="list-row">
        <ListRow>Notes</ListRow>
      </div>
      <div data-probe="slider">
        <Slider aria-label="Volume" defaultValue={[40]} />
      </div>
      <div data-probe="progress">
        <Progress value={40} label="Indexing" />
      </div>
      <div data-probe="tabs">
        <Tabs defaultValue="a">
          <TabsList aria-label="Views">
            <TabsTrigger value="a">A</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel</TabsContent>
        </Tabs>
      </div>

      <div data-probe="native-select-sm">
        <NativeSelect size="sm" aria-label="Kind">
          <option>All</option>
        </NativeSelect>
      </div>
      <div data-probe="input-group-sm">
        <InputGroup size="sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search the graph" />
        </InputGroup>
      </div>

      <Card data-testid="card-default">
        <CardHeader>
          <CardTitle>Default</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
      <Card size="sm" data-testid="card-sm">
        <CardHeader>
          <CardTitle>Small</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>

      <div class="w-48" data-testid="tabs-scrollable">
        <Tabs defaultValue="overview">
          <TabsList scrollable aria-label="Source settings">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="folders">Folders</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div class="w-80" data-testid="tabs-fill">
        <Tabs defaultValue="document">
          <TabsList fill aria-label="Document views">
            <TabsTrigger value="document">Document</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div class="w-80" data-testid="tabs-default">
        <Tabs defaultValue="document">
          <TabsList aria-label="Default document views">
            <TabsTrigger value="document">Document</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </main>
  ),
  document.body
)
