#!/usr/bin/env node
import { runThemeCommand } from '../src/index.js';
process.exitCode = await runThemeCommand(process.argv.slice(2));
