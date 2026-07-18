#!/usr/bin/env ts-node
import { Command } from 'commander';
import { registerDbCommand } from './commands/db';
import { registerQualityCommand } from './commands/quality/quality.command';

const program = new Command();

program.name('forge').description('Nest Forge CLI').version('1.0.0');

registerDbCommand(program);
registerQualityCommand(program);

program.parse(process.argv);
