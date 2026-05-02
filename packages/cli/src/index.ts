#!/usr/bin/env bun
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import {
  type PackageManager,
  type ScaffoldTemplateId,
  createScaffoldProject,
  listScaffoldTemplates,
  parseInitArgs,
} from "./scaffold";

async function main(args: string[]): Promise<void> {
  const parsed = parseInitArgs(args);

  if (parsed.command === "help") {
    stdout.write(createHelpText());
    return;
  }

  if (parsed.command === "list-templates") {
    stdout.write(createTemplateListText());
    return;
  }

  if (parsed.yes) {
    const result = await createScaffoldProject({
      force: parsed.force,
      packageManager: parsed.packageManager,
      targetDirectory: parsed.targetDirectory ?? "lunch-table-game",
      templateId: parsed.templateId ?? "tcg",
    });
    stdout.write(
      createSuccessText(result.targetDirectory, parsed.packageManager),
    );
    return;
  }

  const prompts = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const targetDirectory =
      parsed.targetDirectory ?? (await prompts.question("Project directory: "));
    const templateId = parsed.templateId ?? (await promptForTemplate(prompts));

    const result = await createScaffoldProject({
      force: parsed.force,
      packageManager: parsed.packageManager,
      targetDirectory,
      templateId,
    });

    stdout.write(
      createSuccessText(result.targetDirectory, parsed.packageManager),
    );
  } finally {
    prompts.close();
  }
}

function createHelpText(): string {
  return `Lunch Table Games CLI

Usage:
  lunchtable init [directory] [--template <id>] [--yes]
  lunchtable templates

Templates:
${createTemplateListText()}`;
}

function createTemplateListText(): string {
  return listScaffoldTemplates()
    .map(
      (template) =>
        `  ${template.id.padEnd(13)} ${template.name} - ${template.description}`,
    )
    .join("\n")
    .concat("\n");
}

async function promptForTemplate(prompts: {
  question: (query: string) => Promise<string>;
}): Promise<ScaffoldTemplateId> {
  const templates = listScaffoldTemplates();
  stdout.write(createTemplateListText());

  const answer = await prompts.question("Template: ");
  const matched = templates.find(
    (template, index) =>
      template.id === answer.trim() || String(index + 1) === answer.trim(),
  );

  if (matched === undefined) {
    throw new Error(
      "Template must be one of: tcg, dice, side-scroller, shooter-3d",
    );
  }

  return matched.id;
}

function createSuccessText(
  targetDirectory: string,
  packageManager: PackageManager,
): string {
  return `Created ${targetDirectory}

Next:
  cd ${targetDirectory}
  ${packageManager} install
  ${packageManager} run test
`;
}

main(process.argv.slice(2)).catch((error: Error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
