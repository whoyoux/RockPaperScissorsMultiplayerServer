export class Logger {
  private prefix: string = "";

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  log(message: string) {
    console.log(`${this.prefix}: ${message}`);
  }
}
