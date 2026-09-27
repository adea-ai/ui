import * as dialog from '../../src/components/ui/dialog/dialog'
import * as sheet from '../../src/components/ui/sheet/sheet'
import { Command } from 'cmdk-solid'
import * as alertDialog from '../../src/components/ui/alert-dialog/alert-dialog'
import { mountKobalteOverlayRoleFixture } from './kobalte-overlay-role-fixture'

document.documentElement.dataset.cmdkDialogRootImport = typeof Command

mountKobalteOverlayRoleFixture({
  dialog,
  sheet,
  alertDialog,
})
