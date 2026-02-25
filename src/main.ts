function suppressIfLockManagerMessage(args: any[]): boolean {
  return args.some(arg => {
    if (typeof arg === 'string' && arg.includes('Navigator LockManager lock')) return true;
    if (arg instanceof Error && arg.message.includes('Navigator LockManager lock')) return true;
    return false;
  });
}

const originalConsoleError = console.error;

console.error = function (...args) {
  if (suppressIfLockManagerMessage(args)) return;
  originalConsoleError.apply(console, args);
};

window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;
  if (
    reason instanceof Error &&
    reason.message.includes('Navigator LockManager lock')
  ) {
    event.preventDefault(); // Silently ignore
  }
});

// Angular bootstrapping
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
