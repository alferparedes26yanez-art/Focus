// A missing or wrong environment variable. The message names the variable and
// how to fix it (never its value), so it is safe to show on the login page
// while the app is being set up.
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
