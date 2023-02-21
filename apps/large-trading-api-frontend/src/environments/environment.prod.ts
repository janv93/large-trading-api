import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: true,
  ...environmentSecrets
};