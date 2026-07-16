#!/usr/bin/env ts-node
import { Command } from 'commander';
import { registerDbCommand } from './commands/db';

const program = new Command();

program.name('forge').description('Nest Forge CLI').version('1.0.0');

registerDbCommand(program);

program.parse(process.argv);
