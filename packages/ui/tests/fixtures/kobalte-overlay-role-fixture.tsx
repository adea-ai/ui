import { render } from 'solid-js/web'

type DialogModule = typeof import('../../src/components/ui/dialog/dialog')
type SheetModule = typeof import('../../src/components/ui/sheet/sheet')
type AlertDialogModule = typeof import('../../src/components/ui/alert-dialog/alert-dialog')

export function mountKobalteOverlayRoleFixture({
  dialog,
  sheet,
  alertDialog,
}: {
  dialog: DialogModule
  sheet: SheetModule
  alertDialog: AlertDialogModule
}) {
  const { Dialog, DialogContent, DialogTitle, DialogTrigger } = dialog
  const { Sheet, SheetContent, SheetTitle, SheetTrigger } = sheet
  const {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTitle,
    AlertDialogTrigger,
  } = alertDialog

  return render(
    () => (
      <>
        <main>
          <Dialog>
            <DialogTrigger>Open regular dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Regular dialog title</DialogTitle>
              <button type="button">Regular dialog action</button>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger>Open details sheet</SheetTrigger>
            <SheetContent>
              <SheetTitle>Details sheet title</SheetTitle>
              <button type="button">Details sheet action</button>
            </SheetContent>
          </Sheet>
          <AlertDialog>
            <AlertDialogTrigger>Open confirmation</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Confirm irreversible action</AlertDialogTitle>
              <AlertDialogCancel>Keep item</AlertDialogCancel>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </>
    ),
    document.body
  )
}
