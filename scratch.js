import { Command } from "commander";
const program = new Command();
program
  .name("airlock")
  .version("1.0.0");
program.command("guard").action(() => console.log("guard"));

program.parse(process.argv);
if (process.argv.length < 3) {
  program.help();
}
