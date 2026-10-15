import { render } from 'solid-js/web'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../src/components/ui/card/card'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main>
      <Card class="w-96" data-testid="plain">
        <CardHeader data-testid="plain-header">
          <CardTitle>Nightly soak</CardTitle>
          <CardDescription>Runs the endurance lane at 02:00.</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
      <Card class="w-96" data-testid="action">
        <CardHeader data-testid="action-header">
          <CardTitle>Release 0.55.0</CardTitle>
          <CardDescription>Cut from main on 24 September.</CardDescription>
          <CardAction data-testid="action-slot">
            <span class="inline-block h-6 w-20">Published</span>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
      <Card class="w-96" data-testid="title-only">
        <CardHeader data-testid="title-only-header">
          <CardTitle data-testid="title-only-title">
            A very long principal name that has to wrap
          </CardTitle>
          <CardAction data-testid="title-only-slot">
            <span class="inline-block h-8 w-8">x</span>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
      <Card class="w-96" size="sm" data-testid="small">
        <CardHeader data-testid="small-header">
          <CardTitle>Small</CardTitle>
          <CardAction data-testid="small-slot">
            <span class="inline-block h-6 w-12">Live</span>
          </CardAction>
        </CardHeader>
      </Card>
    </main>
  )
}

render(() => <Fixture />, document.body)
