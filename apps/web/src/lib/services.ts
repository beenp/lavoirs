import type { AppServices } from '../../../../packages/shared/src/auth';
import { createDemoServices } from './demo-services';
import { createLocalServices } from './local-services';

// The only production wiring point: replace this with your auth/profile adapters.
export const services: AppServices = import.meta.env.DEV ? createLocalServices() : createDemoServices();
