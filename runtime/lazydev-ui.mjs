#!/usr/bin/env node
import { cliui } from '@poppinss/cliui';

const ui = cliui();
const packageVersion = '6.8.1';

async function demo() {
  ui.logger.info('WORKS  Logger');
  ui.logger.action('WORKS  Action').succeeded();

  const spinner = ui.logger.await('WORKS  Spinner');
  spinner.start();
  spinner.stop();

  const table = ui.table();
  table.head(['Component', 'Status'])
    .row(['Logger', ui.colors.green('WORKS')])
    .row(['Action', ui.colors.green('WORKS')])
    .row(['Spinner', ui.colors.green('WORKS')])
    .row(['Tasks', ui.colors.green('WORKS')])
    .render();

  ui.instructions()
    .add('WORKS  Instructions')
    .render();

  ui.sticker()
    .add('WORKS  Sticker')
    .render();

  const steps = ui.steps();
  steps
    .add('Steps', 'WORKS')
    .add('UI runtime', `@poppinss/cliui@${packageVersion}`)
    .render();

  await ui.tasks()
    .add('Tasks', async () => 'WORKS')
    .run();

  console.log();
  console.log(`${ui.colors.green('✓')} LazyDev CLI UI ${ui.colors.cyan(packageVersion)} is working`);
}

if (process.argv[2] === 'demo') {
  await demo();
} else {
  console.error('Usage: lazydev ui-demo');
  process.exit(2);
}
